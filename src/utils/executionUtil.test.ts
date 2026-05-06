import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { PromotedWidgetView } from '@/core/graph/subgraph/promotedWidgetView'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { usePromotionStore } from '@/stores/promotionStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { makeCompositeKey } from '@/utils/compositeKey'

import { graphToPrompt } from './executionUtil'

describe('graphToPrompt with promoted subgraph widgets (PR #11811)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    resetSubgraphFixtureState()
  })

  it('emits the user-edited promoted value, not the interior default', async () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })

    // Interior node with a text widget "value" defaulting to "interior"
    const interiorNode = new LGraphNode('Interior')
    interiorNode.addWidget('text', 'value', 'interior', () => {})
    subgraph.add(interiorNode)

    // SubgraphNode instance in the root graph
    const subgraphNode = createTestSubgraphNode(subgraph, {
      parentGraph: rootGraph
    })
    rootGraph.add(subgraphNode)

    // Promote the interior widget (mirrors proxyWidgets=[["<id>","value"]])
    usePromotionStore().promote(rootGraph.id, subgraphNode.id, {
      sourceNodeId: String(interiorNode.id),
      sourceWidgetName: 'value'
    })

    // User-edits the exterior promoted widget to "exterior". This is the same
    // path the Vue widget update handler exercises in production.
    const view = subgraphNode.widgets[0] as PromotedWidgetView | undefined
    if (!view) throw new Error('Expected a promoted view on the SubgraphNode')
    view.value = 'exterior'

    const { output } = await graphToPrompt(rootGraph)

    const execId = `${subgraphNode.id}:${interiorNode.id}`
    expect(output[execId]).toBeDefined()
    expect(output[execId].inputs.value).toBe('exterior')
  })

  it('isolates promoted values across two SubgraphNode instances of the same Subgraph', async () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })

    const interiorNode = new LGraphNode('Interior')
    interiorNode.addWidget('text', 'value', 'interior', () => {})
    subgraph.add(interiorNode)

    const instanceA = createTestSubgraphNode(subgraph, {
      parentGraph: rootGraph
    })
    rootGraph.add(instanceA)
    const instanceB = createTestSubgraphNode(subgraph, {
      parentGraph: rootGraph
    })
    rootGraph.add(instanceB)

    const promotionStore = usePromotionStore()
    promotionStore.promote(rootGraph.id, instanceA.id, {
      sourceNodeId: String(interiorNode.id),
      sourceWidgetName: 'value'
    })
    promotionStore.promote(rootGraph.id, instanceB.id, {
      sourceNodeId: String(interiorNode.id),
      sourceWidgetName: 'value'
    })

    const storeName = makeCompositeKey([String(interiorNode.id), 'value', ''])
    const widgetStore = useWidgetValueStore()
    widgetStore.registerWidget(rootGraph.id, {
      nodeId: instanceA.id,
      name: storeName,
      type: 'text',
      value: 'A-value',
      options: {}
    })
    widgetStore.registerWidget(rootGraph.id, {
      nodeId: instanceB.id,
      name: storeName,
      type: 'text',
      value: 'B-value',
      options: {}
    })

    const { output } = await graphToPrompt(rootGraph)

    expect(output[`${instanceA.id}:${interiorNode.id}`].inputs.value).toBe(
      'A-value'
    )
    expect(output[`${instanceB.id}:${interiorNode.id}`].inputs.value).toBe(
      'B-value'
    )
  })

  it('emits the per-instance promoted value for a lazy-creation interior (PrimitiveNode-like)', async () => {
    // Mimics PrimitiveNode lazy widget creation (src/extensions/core/widgetInputs.ts:32+).
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

    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })

    const interiorNode = new LazyPrimitiveLikeNode()
    interiorNode.widgets_values = ['interior']
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, {
      parentGraph: rootGraph
    })
    rootGraph.add(subgraphNode)

    // Configure with proxyWidgets + exterior before the interior exists.
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
        proxyWidgets: [[String(interiorNode.id), 'value']]
      },
      widgets_values: ['exterior']
    })

    // Lazy materialization clobbers exterior with widgets_values=["interior"].
    interiorNode.onAfterGraphConfigured()

    // SubgraphNode hook re-projects the per-instance override afterward.
    subgraphNode.onAfterGraphConfigured?.()

    const { output } = await graphToPrompt(rootGraph)
    const execId = `${subgraphNode.id}:${interiorNode.id}`
    expect(output[execId]).toBeDefined()
    expect(output[execId].inputs.value).toBe('exterior')
  })
})
