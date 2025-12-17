import { describe, expect, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphBadge } from '@/lib/litegraph/src/LGraphBadge'

import { subgraphTest } from '../../litegraph/subgraph/fixtures/subgraphFixtures'

import { usePriceBadge } from '@/composables/node/usePriceBadge'

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
// Use a badge created by getCreditsBadge to match the expected format
const creditsBadge = getCreditsBadge('$0.05/Run')
mockNode.badges = [creditsBadge]

// Create a type-compatible reference for tests
const badge: Partial<LGraphBadge> = {
  icon: creditsBadge.icon,
  text: '$0.05/Run'
}
mockNode.badges = [badge as LGraphBadge]

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
})
