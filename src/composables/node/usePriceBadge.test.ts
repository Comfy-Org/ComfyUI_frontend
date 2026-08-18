import { describe, expect, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { subgraphTest } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphFixtures'

import { usePriceBadge } from '@/composables/node/usePriceBadge'

const getNodeDisplayPrice = vi.fn(
  (_node: LGraphNode, overrides?: ReadonlyMap<string, unknown>) =>
    String(overrides?.get('prompt') ?? 'missing override')
)

vi.mock('@/composables/node/useNodePricing', () => ({
  useNodePricing: () => ({ getNodeDisplayPrice })
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => ({
    completedActivePalette: {
      light_theme: false,
      colors: { litegraph_base: {} }
    }
  })
}))

const { updateSubgraphCredits, getCreditsBadge } = usePriceBadge()

const mockNode = new LGraphNode('mock node')
mockNode.badges = [getCreditsBadge('$0.05/Run')]

function getBadgeText(node: LGraphNode): string {
  const badge = node.badges[0]
  return (typeof badge === 'function' ? badge() : badge).text
}

describe('subgraph pricing', () => {
  subgraphTest(
    'should not display badge for subgraphs without API nodes',
    ({ subgraphWithNode }) => {
      const { subgraphNode } = subgraphWithNode
      updateSubgraphCredits(subgraphNode)
      expect(subgraphNode.badges.length).toBe(0)
    }
  )
  subgraphTest(
    'should return the price of a single contained API node',
    ({ subgraphWithNode }) => {
      const { subgraphNode, subgraph } = subgraphWithNode
      subgraph.add(mockNode)
      updateSubgraphCredits(subgraphNode)
      expect(subgraphNode.badges.length).toBe(1)
      expect(getBadgeText(subgraphNode)).toBe('$0.05/Run')
    }
  )
  subgraphTest(
    'should return the number of api nodes if more than one exists',
    ({ subgraphWithNode }) => {
      const { subgraphNode, subgraph } = subgraphWithNode
      for (let i = 0; i < 5; i++) subgraph.add(mockNode)
      updateSubgraphCredits(subgraphNode)
      expect(subgraphNode.badges.length).toBe(1)
      expect(getBadgeText(subgraphNode)).toBe('Partner Nodes x 5')
    }
  )

  subgraphTest(
    'uses promoted widget override from any matching internal link',
    ({ subgraphWithNode }) => {
      const { subgraphNode, subgraph } = subgraphWithNode
      class ApiNode extends LGraphNode {
        static override nodeData = { name: 'ApiNode', api_node: true }
      }
      const apiNode = new ApiNode('api node')
      apiNode.badges = [getCreditsBadge('$0.05/Run')]
      const apiInput = apiNode.addInput('prompt', 'STRING')
      apiInput.widget = { name: 'prompt' }
      apiNode.addWidget('string', 'prompt', 'inner value', () => undefined, {})

      const decoyNode = new LGraphNode('decoy node')
      const decoyInput = decoyNode.addInput('prompt', 'STRING')
      decoyInput.widget = { name: 'prompt' }
      decoyNode.addWidget(
        'string',
        'prompt',
        'decoy value',
        () => undefined,
        {}
      )

      subgraph.add(decoyNode)
      subgraph.add(apiNode)
      subgraph.inputNode.slots[0].connect(decoyInput, decoyNode)
      subgraph.inputNode.slots[0].connect(apiInput, apiNode)
      subgraphNode._internalConfigureAfterSlots()
      const inputWidgetId = subgraphNode.inputs[0].widgetId
      if (!inputWidgetId) throw new Error('Missing promoted input widgetId')
      useWidgetValueStore().setValue(inputWidgetId, 'outer value')

      updateSubgraphCredits(subgraphNode)

      expect(getBadgeText(subgraphNode)).toBe('outer value')
    }
  )
})
