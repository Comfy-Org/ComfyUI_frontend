import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { subgraphTest } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphFixtures'

import { usePriceBadge } from '@/composables/node/usePriceBadge'
import { adjustColor } from '@/utils/colorUtil'

const getNodeDisplayPrice = vi.fn(
  (_node: LGraphNode, overrides?: ReadonlyMap<string, unknown>) =>
    String(overrides?.get('prompt') ?? 'missing override')
)

const mockPalette = vi.hoisted(() => ({
  completedActivePalette: {
    light_theme: false,
    colors: {
      litegraph_base: {
        BADGE_FG_COLOR: '#ffffff'
      }
    }
  }
}))

vi.mock('@/composables/node/useNodePricing', () => ({
  useNodePricing: () => ({ getNodeDisplayPrice })
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => mockPalette
}))

const { updateSubgraphCredits, getCreditsBadge, isCreditsBadge } =
  usePriceBadge()

const mockNode = new LGraphNode('mock node')
mockNode.badges = [getCreditsBadge('$0.05/Run')]

function getBadgeText(node: LGraphNode): string {
  const badge = node.badges[0]
  return (typeof badge === 'function' ? badge() : badge).text
}

describe('subgraph pricing', () => {
  beforeEach(() => {
    mockPalette.completedActivePalette.light_theme = false
  })

  it('identifies credit badges and ignores unrelated badges', () => {
    expect(isCreditsBadge(getCreditsBadge('$0.05/Run'))).toBe(true)
    expect(isCreditsBadge(() => getCreditsBadge('$0.05/Run'))).toBe(true)
    expect(isCreditsBadge({ text: 'other' })).toBe(false)
  })

  it('uses the adjusted credits background in light themes', () => {
    mockPalette.completedActivePalette.light_theme = true

    expect(getCreditsBadge('$0.05/Run').bgColor).toBe(
      adjustColor('#8D6932', { lightness: 0.5 })
    )
  })

  it('does nothing for non-subgraph nodes', () => {
    const node = new LGraphNode('plain node')
    const badge = getCreditsBadge('$0.05/Run')
    node.badges = [badge]

    updateSubgraphCredits(node)

    expect(node.badges).toEqual([badge])
  })

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
