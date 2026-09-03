import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { serializeDocumentScope } from '@/core/graph/document/documentSerializer'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import { widgetId } from '@/types/widgetId'
import { createNodeState } from '@/utils/__tests__/litegraphTestUtils'

function scopeFor(graphId: string): GraphScope {
  return {
    rootGraphId: toRootGraphId(graphId),
    owningGraphId: toOwningGraphId(graphId)
  }
}

function inputSlot(overrides: Partial<INodeInputSlot> = {}): INodeInputSlot {
  return { name: 'in', type: 'INT', ...overrides } as INodeInputSlot
}

function outputSlot(overrides: Partial<INodeOutputSlot> = {}): INodeOutputSlot {
  return { name: 'out', type: 'INT', ...overrides } as INodeOutputSlot
}

function decode(bytes: Uint8Array): {
  nodes: Array<
    Record<string, unknown> & {
      inputs: Record<string, unknown>[]
      outputs: Record<string, unknown>[]
      widgets: Record<string, unknown>[]
    }
  >
  links: Record<string, unknown>[]
} {
  return JSON.parse(new TextDecoder().decode(bytes))
}

/** Registers one node (with slots), one widget, and one link in `graphId`. */
function populateScope(
  graphId: string,
  slots: { input: INodeInputSlot; output: INodeOutputSlot }
): GraphScope {
  const scope = scopeFor(graphId)
  useNodeDataStore().registerNode(
    scope,
    createNodeState({
      id: toNodeId(1),
      inputs: [slots.input],
      outputs: [slots.output]
    })
  )
  useWidgetValueStore().registerWidget(
    widgetId(scope.rootGraphId, toNodeId(1), 'alpha'),
    { type: 'number', value: 3, options: {} }
  )
  useLinkStore().registerLink(scope, {
    id: toLinkId(9),
    graphId: scope.owningGraphId,
    originNodeId: toNodeId(1),
    originSlot: 0,
    targetNodeId: toNodeId(2),
    targetSlot: 0,
    type: 'INT'
  })
  return scope
}

describe('serializeDocumentScope', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('serializes only allowlisted slot fields, ignoring runtime-only state', () => {
    // Runtime-only junk, including a cycle through `_widget` — the exact
    // shape that would explode JSON.stringify if slots were spread as-is.
    const cyclicWidget: Record<string, unknown> = { name: 'w' }
    cyclicWidget.self = cyclicWidget
    const scope = populateScope('root-junk', {
      input: inputSlot({
        link: toLinkId(5),
        _widget: cyclicWidget as never,
        hasErrors: true,
        boundingRect: [0, 0, 10, 10]
      }),
      output: outputSlot({
        links: [toLinkId(5)],
        _data: { transient: true },
        slot_index: 0
      })
    })

    const decoded = decode(serializeDocumentScope(scope))

    expect(decoded.nodes).toHaveLength(1)
    const [node] = decoded.nodes
    expect(node.inputs[0]).toEqual({ name: 'in', type: 'INT' })
    expect(node.outputs[0]).toEqual({ name: 'out', type: 'INT', slot_index: 0 })
    expect(node.widgets).toEqual([{ name: 'alpha', type: 'number', value: 3 }])
    expect(decoded.links).toEqual([
      {
        id: 9,
        originNodeId: '1',
        originSlot: 0,
        targetNodeId: '2',
        targetSlot: 0,
        type: 'INT'
      }
    ])
  })

  it('produces byte-identical output for identical semantic content regardless of runtime slot state', () => {
    const clean = populateScope('root-clean', {
      input: inputSlot(),
      output: outputSlot()
    })
    const dirty = populateScope('root-dirty', {
      input: inputSlot({
        link: toLinkId(7),
        hasErrors: true
      }),
      output: outputSlot({
        links: [toLinkId(7)],
        _data: 'runtime'
      })
    })

    expect(serializeDocumentScope(clean)).toEqual(serializeDocumentScope(dirty))
  })

  it('sorts widgets by code unit, independent of host locale', () => {
    const scope = scopeFor('root-widget-sort')
    useNodeDataStore().registerNode(scope, createNodeState({ id: toNodeId(1) }))
    const widgetStore = useWidgetValueStore()
    // Registration order: 'a' first. localeCompare would sort 'a' before 'B';
    // code-unit order puts 'B' (66) before 'a' (97).
    widgetStore.registerWidget(widgetId(scope.rootGraphId, toNodeId(1), 'a'), {
      type: 'number',
      value: 1,
      options: {}
    })
    widgetStore.registerWidget(widgetId(scope.rootGraphId, toNodeId(1), 'B'), {
      type: 'number',
      value: 2,
      options: {}
    })

    const decoded = decode(serializeDocumentScope(scope))

    expect(decoded.nodes[0].widgets.map((widget) => widget.name)).toEqual([
      'B',
      'a'
    ])
  })

  it('throws on pathologically deep semantic state instead of hanging', () => {
    const scope = scopeFor('root-deep')
    let deep: unknown = 0
    for (let i = 0; i < 40; i++) deep = [deep]
    useNodeDataStore().registerNode(
      scope,
      createNodeState({
        id: toNodeId(1),
        properties: { deep: deep as NodeState['properties'][string] }
      })
    )

    expect(() => serializeDocumentScope(scope)).toThrow(
      /max canonicalization depth/
    )
  })
})
