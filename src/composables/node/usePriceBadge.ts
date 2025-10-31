import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphBadge } from '@/lib/litegraph/src/litegraph'

import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'

export const usePriceBadge = () => {
  function updateSubgraphCredits(node: LGraphNode) {
    if (!node.isSubgraphNode()) return
    node.badges = node.badges.filter((b) => !isCreditsBadge(b))
    const newBadges = collectCreditsBadges(node.subgraph)
    if (newBadges.length > 1) {
      node.badges.push(getCreditsBadge('Partner Nodes x ' + newBadges.length))
    } else {
      node.badges.push(...newBadges)
    }
  }
  function collectCreditsBadges(
    graph: LGraph,
    visited: Set<string> = new Set()
  ): (LGraphBadge | (() => LGraphBadge))[] {
    if (visited.has(graph.id)) return []
    visited.add(graph.id)
    const badges = []
    for (const node of graph.nodes) {
      badges.push(
        ...(node.isSubgraphNode()
          ? collectCreditsBadges(node.subgraph, visited)
          : node.badges.filter((b) => isCreditsBadge(b)))
      )
    }
    return badges
  }

  function isCreditsBadge(badge: LGraphBadge | (() => LGraphBadge)): boolean {
    return (
      (typeof badge === 'function' ? badge() : badge).icon?.unicode === '\ue96b'
    )
  }

  const colorPaletteStore = useColorPaletteStore()
  function getCreditsBadge(price: string): LGraphBadge {
    const isLightTheme = colorPaletteStore.completedActivePalette.light_theme
    return new LGraphBadge({
      text: price,
      iconOptions: {
        unicode: '\ue96b',
        fontFamily: 'PrimeIcons',
        color: isLightTheme
          ? adjustColor('#FABC25', { lightness: 0.5 })
          : '#FABC25',
        bgColor: isLightTheme
          ? adjustColor('#654020', { lightness: 0.5 })
          : '#654020',
        fontSize: 8
      },
      fgColor:
        colorPaletteStore.completedActivePalette.colors.litegraph_base
          .BADGE_FG_COLOR,
      bgColor: isLightTheme
        ? adjustColor('#8D6932', { lightness: 0.5 })
        : '#8D6932'
    })
  }
  return {
    getCreditsBadge,
    updateSubgraphCredits
  }
}
