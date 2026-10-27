import { MAX_OVERFLOW_WIDGETS, nodesMap } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useLitegraphService } from '@/services/litegraphService'
import { toNodeId } from '@/types/nodeId'
import { followedDoc } from '@/workbench/extensions/agent/crdt/__fixtures__/followedDoc'
import { LiveGraphApplier } from '@/workbench/extensions/agent/crdt/liveGraphApplier'

import {
  dynamicGroupRowAllocationBound,
  MAX_DYNAMIC_GROUP_ROWS,
  MAX_DYNAMIC_GROUP_ROW_RESOURCES
} from './dynamicGroupDiagnostics'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: false }))
vi.mock(import('@/platform/telemetry/reportError'))

const MAX = 3
const FIELDS_PER_ROW = 1
const ALLOCATION_BOUND = Math.min(
  MAX_DYNAMIC_GROUP_ROWS,
  Math.floor(MAX_DYNAMIC_GROUP_ROW_RESOURCES / (FIELDS_PER_ROW * 3 + 1))
)

function addGroup(node: LGraphNode) {
  useLitegraphService().addNodeInput(node, {
    name: 'rows',
    type: 'COMFY_DYNAMICGROUP_V3',
    isOptional: false,
    min: 0,
    max: MAX,
    template: { required: { strength: ['FLOAT', { default: 1 }] } }
  })
}

function appliedFromDocument(
  type: string,
  count: number,
  storage: 'named' | 'positional' = 'named'
) {
  const graph = new LGraph()
  const { doc, collector } = followedDoc(
    {
      nodes: [
        { id: 1, type, pos: [0, 0], size: [210, 100], widgets_values: [count] }
      ],
      links: []
    },
    storage === 'named'
      ? { types: { [type]: { widget_order: ['rows'] } } }
      : { types: {} }
  )
  const applier = new LiveGraphApplier({ getGraph: () => graph })
  const { failureCount } = applier.applyChanges(doc, collector.take(), {
    actor: 'agent:test',
    opIds: ['op-1']
  })
  const node = graph.getNodeById(toNodeId(1))
  const rows = node?.widgets?.find((widget) => widget.name === 'rows')
  if (!node || !rows) throw new Error('DynamicGroup node 1 was not created')
  return { node, rows, failureCount }
}

function writtenToDocument(type: string, count: unknown) {
  const graph = new LGraph()
  const { doc, collector } = followedDoc(
    {
      nodes: [
        { id: 1, type, pos: [0, 0], size: [210, 100], widgets_values: [1] }
      ],
      links: []
    },
    { types: { [type]: { widget_order: ['rows', 'rows.0.strength'] } } }
  )
  const applier = new LiveGraphApplier({ getGraph: () => graph })
  const context = { actor: 'agent:test', opIds: ['op-1'] }
  applier.applyChanges(doc, collector.take(), context)
  const node = graph.getNodeById(toNodeId(1))
  const rows = node?.widgets?.find((widget) => widget.name === 'rows')
  if (!node || !rows) throw new Error('DynamicGroup node 1 was not created')
  const changed = vi.fn()
  node.onWidgetChanged = changed
  const version = graph._version
  doc.transact(() => {
    const widgets = nodesMap(doc).get('1')?.get('widgets')
    if (!(widgets instanceof Y.Map)) throw new Error('named storage')
    widgets.set('rows', count)
  })
  const { failureCount } = applier.applyChanges(doc, collector.take(), context)
  return {
    node,
    rows,
    failureCount,
    changed,
    versionDelta: graph._version - version
  }
}

function click(widget: IBaseWidget, node: LGraphNode, n: number) {
  for (let index = 0; index < n; index++)
    widget.callback?.(undefined, undefined, node)
}

function floatFields(
  count: number
): Record<string, ['FLOAT', { default: number }]> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `field_${index}`,
      ['FLOAT', { default: 1 }] as ['FLOAT', { default: number }]
    ])
  )
}

beforeEach(() => {
  remoteConfig.value = { enable_telemetry: true }
  for (const type of [
    'BoundaryAddNodeAboveMax',
    'BoundaryAddNodeUnbounded',
    'BoundaryWriteAboveMax',
    'BoundaryWriteUnbounded',
    'BoundaryLocalAboveMax'
  ]) {
    LiteGraph.registerNodeType(
      type,
      class extends LGraphNode {
        constructor() {
          super('Boundary Dynamic Group')
          this.serialize_widgets = true
          addGroup(this)
        }
      }
    )
  }
})

describe('the document owns the row count above max', () => {
  it('applies a count above max arriving on the remote add_node path', () => {
    const { rows } = appliedFromDocument('BoundaryAddNodeAboveMax', MAX + 2)

    expect(rows.value).toBe(MAX + 2)
  })

  it('applies a count above max from a positional widget array', () => {
    const { rows, failureCount } = appliedFromDocument(
      'BoundaryAddNodeAboveMax',
      MAX + 2,
      'positional'
    )

    expect([rows.value, failureCount]).toEqual([MAX + 2, 0])
  })

  it('applies a count above max arriving as a remote widget write', () => {
    const { rows, failureCount } = writtenToDocument(
      'BoundaryWriteAboveMax',
      MAX + 1
    )

    expect([rows.value, failureCount]).toEqual([MAX + 1, 0])
  })
})

describe('every layer bounds allocation independently', () => {
  it('refuses an unbounded count on the remote add_node path', () => {
    const { rows, failureCount } = appliedFromDocument(
      'BoundaryAddNodeUnbounded',
      ALLOCATION_BOUND + 1
    )

    expect([rows.value, failureCount]).toEqual([0, 1])
  })

  it('refuses an unbounded count on a remote widget write', () => {
    const { rows, failureCount, changed, versionDelta } = writtenToDocument(
      'BoundaryWriteUnbounded',
      ALLOCATION_BOUND + 1
    )

    expect([rows.value, failureCount]).toEqual([1, 1])
    expect(changed).not.toHaveBeenCalled()
    expect(versionDelta).toBe(0)
  })

  it('pins the frontend row cap below the document package budget', () => {
    expect(ALLOCATION_BOUND).toBeLessThanOrEqual(
      Math.floor(MAX_OVERFLOW_WIDGETS / FIELDS_PER_ROW)
    )
  })

  it('derives a mixed-template bound from every field plus its row header', () => {
    const node = new LGraphNode('Mixed group', 'BoundaryMixedTemplate')
    useLitegraphService().addNodeInput(node, {
      name: 'rows',
      type: 'COMFY_DYNAMICGROUP_V3',
      isOptional: false,
      min: 0,
      max: MAX,
      template: {
        required: {
          a: ['FLOAT', { default: 1 }],
          b: ['FLOAT', { default: 1 }],
          c: ['FLOAT', { default: 1 }],
          d: ['FLOAT', { default: 1 }],
          e: ['FLOAT', { default: 1 }],
          f: ['FLOAT', { default: 1 }]
        }
      }
    })
    const rows = node.widgets?.find((widget) => widget.name === 'rows')
    if (!rows) throw new Error('Missing mixed DynamicGroup controller')

    expect(dynamicGroupRowAllocationBound(rows)).toBe(215)
    expect(dynamicGroupRowAllocationBound(rows)).toBeLessThanOrEqual(
      Math.floor(MAX_OVERFLOW_WIDGETS / 6)
    )
  })
})

describe('the local producer still keeps authored counts inside max', () => {
  it('disables adding a row at max', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Group', 'BoundaryLocalAboveMax')
    node.serialize_widgets = true
    graph.add(node)
    addGroup(node)
    const widget = (name: string) => {
      const found = node.widgets?.find((widget) => widget.name === name)
      if (!found) throw new Error(`Missing widget ${name}`)
      return found
    }
    const rows = widget('rows')
    const add = widget('rows.$add')

    click(add, node, MAX + 2)

    expect([rows.value, add.options.disabled]).toEqual([MAX, true])
  })

  it('rejects a schema min above the allocation bound', () => {
    const node = new LGraphNode('Wide group', 'BoundaryWideTemplate')

    expect(() =>
      useLitegraphService().addNodeInput(node, {
        name: 'rows',
        type: 'COMFY_DYNAMICGROUP_V3',
        isOptional: false,
        min: 20,
        max: 20,
        template: { required: floatFields(100) }
      })
    ).toThrow('Row count exceeds the allocation bound')
  })
})
