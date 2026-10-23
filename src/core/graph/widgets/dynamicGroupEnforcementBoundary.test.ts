/**
 * Cross-boundary regressions for DynamicGroup row-count enforcement.
 *
 * The boundary these pin is stated in
 * `docs/adr/DYNAMIC-GROUP-0047-row-count-enforcement-boundary.md`:
 *
 *  - Core owns `min..max` as an executability policy.
 *  - Producers (the local UI, comfy-cli) keep authored counts inside `min..max`.
 *  - Transports and followers preserve the count the document carries and bound
 *    only allocation.
 *
 * So these assert both halves: a count above `max` arriving from the document
 * applies, and a count above the allocation bound is refused — on every path a
 * remote count can reach the live graph, not just the one the applier walks.
 */
import { MAX_OVERFLOW_WIDGETS, nodesMap } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useLitegraphService } from '@/services/litegraphService'
import { toNodeId } from '@/types/nodeId'
import { followedDoc } from '@/workbench/extensions/agent/crdt/__fixtures__/followedDoc'
import { LiveGraphApplier } from '@/workbench/extensions/agent/crdt/liveGraphApplier'

import { MAX_DYNAMIC_GROUP_ROW_WIDGETS } from './dynamicGroupDiagnostics'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: false }))
vi.mock(import('@/platform/telemetry/reportError'))

const MAX = 3
const FIELDS_PER_ROW = 1
const ALLOCATION_BOUND = Math.floor(
  MAX_DYNAMIC_GROUP_ROW_WIDGETS / FIELDS_PER_ROW
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

/**
 * A followed document holding `rows: count` for one DynamicGroup node, applied
 * from scratch so the count travels the remote `add_node` path rather than the
 * widget-write path.
 */
function appliedFromDocument(type: string, count: number) {
  const graph = new LGraph()
  const { doc, collector } = followedDoc(
    {
      nodes: [
        { id: 1, type, pos: [0, 0], size: [210, 100], widgets_values: [count] }
      ],
      links: []
    },
    { types: { [type]: { widget_order: ['rows'] } } }
  )
  const applier = new LiveGraphApplier({ getGraph: () => graph })
  applier.applyChanges(doc, collector.take(), {
    actor: 'agent:test',
    opIds: ['op-1']
  })
  const node = graph.getNodeById(toNodeId(1))
  const rows = node?.widgets?.find((widget) => widget.name === 'rows')
  if (!node || !rows) throw new Error('DynamicGroup node 1 was not created')
  return { node, rows }
}

/** A followed document whose `rows` count is then changed to `count`. */
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
  doc.transact(() => {
    const widgets = nodesMap(doc).get('1')?.get('widgets')
    if (!(widgets instanceof Y.Map)) throw new Error('named storage')
    widgets.set('rows', count)
  })
  const { failureCount } = applier.applyChanges(doc, collector.take(), context)
  return { node, rows, failureCount }
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
    const { rows } = appliedFromDocument(
      'BoundaryAddNodeUnbounded',
      ALLOCATION_BOUND + 1
    )

    expect(rows.value).toBe(0)
  })

  it('refuses an unbounded count on a remote widget write', () => {
    const { rows, failureCount } = writtenToDocument(
      'BoundaryWriteUnbounded',
      ALLOCATION_BOUND + 1
    )

    expect([rows.value, failureCount]).toEqual([1, 1])
  })

  it('is not stricter than the allocation bound the document layer holds', () => {
    expect(MAX_DYNAMIC_GROUP_ROW_WIDGETS).toBeGreaterThanOrEqual(
      MAX_OVERFLOW_WIDGETS
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

    for (let click = 0; click < MAX + 2; click++)
      add.callback?.(undefined, undefined, node)

    expect([rows.value, add.options.disabled]).toEqual([MAX, true])
  })
})
