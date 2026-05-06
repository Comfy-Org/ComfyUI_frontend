import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// Barrel import for SubgraphNode/LGraph circular dep
import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({})
}))
vi.mock('@/stores/domWidgetStore', () => ({
  useDomWidgetStore: () => ({
    widgetStates: new Map(),
    setPositionOverride: vi.fn(),
    clearPositionOverride: vi.fn()
  })
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ updatePreviews: () => ({}) })
}))

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

/**
 * Mimics PrimitiveNode (src/extensions/core/widgetInputs.ts:32+) — empty
 * widgets until onAfterGraphConfigured creates them and re-applies
 * widgets_values. Reproduces the load-time race against
 * SubgraphNode._replayPromotedWidgetValues.
 */
class LazyPrimitiveLikeNode extends LGraphNode {
  constructor() {
    super('LazyPrimitiveLike')
    this.serialize_widgets = true
  }

  override onAfterGraphConfigured(): void {
    if (this.widgets?.length) return
    const widget = this.addWidget('text', 'value', '', () => {})
    const stored = this.widgets_values
    if (stored?.length) {
      widget.value = stored[0] as string
    }
  }
}

describe('PromotedWidgetView with lazy-creation interior widget', () => {
  test('per-instance "exterior" override survives interior lazy widget materialization', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })

    const interior = new LazyPrimitiveLikeNode()
    interior.widgets_values = ['interior']
    subgraph.add(interior)

    const subgraphNode = createTestSubgraphNode(subgraph, {
      parentGraph: rootGraph
    })
    rootGraph.add(subgraphNode)

    // Drive the load path: configure with proxyWidgets and exterior value.
    subgraphNode.configure({
      id: subgraphNode.id,
      type: subgraph.id,
      pos: [100, 100],
      size: [200, 100],
      inputs: [],
      outputs: [],
      mode: 0,
      order: 0,
      flags: {},
      properties: {
        proxyWidgets: [[String(interior.id), 'value']]
      },
      widgets_values: ['exterior']
    })

    // _replayPromotedWidgetValues has run, but interior.widgets is empty —
    // write-through no-ops; only the per-instance override holds "exterior".
    expect(interior.widgets?.length ?? 0).toBe(0)

    // Lazy materialization clobbers any prior interior write with the
    // serialized widgets_values=["interior"].
    interior.onAfterGraphConfigured()
    expect(interior.widgets?.[0].value).toBe('interior')

    // SubgraphNode.onAfterGraphConfigured (called child-first by
    // triggerCallbackOnAllNodes in production) re-projects the per-instance
    // override onto the now-materialized interior widget.
    subgraphNode.onAfterGraphConfigured?.()

    const widgetStore = useWidgetValueStore()
    const view = subgraphNode.widgets[0]
    expect(view.value).toBe('exterior')
    expect(interior.widgets?.[0].value).toBe('exterior')
    const interiorCell = widgetStore.getWidget(
      rootGraph.id,
      interior.id,
      'value'
    )
    expect(interiorCell?.value).toBe('exterior')
  })
})
