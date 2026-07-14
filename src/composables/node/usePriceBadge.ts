import { createSharedComposable } from '@vueuse/core'
import { computed, ref, toValue } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphBadge } from '@/lib/litegraph/src/litegraph'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import { useNodePricing } from '@/composables/node/useNodePricing'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { SubgraphInput } from '@/lib/litegraph/src/subgraph/SubgraphInput'
import { trackNodePrice } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { adjustColor } from '@/utils/colorUtil'
import { mapAllNodes } from '@/utils/graphTraversalUtil'

type LinkedWidgetInput = INodeInputSlot & {
  _subgraphSlot?: SubgraphInput
}

const componentIconSvg = new Image()
componentIconSvg.src =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='oklch(83.01%25 0.163 83.16)' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15.536 11.293a1 1 0 0 0 0 1.414l2.376 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0zm-13.239 0a1 1 0 0 0 0 1.414l2.377 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414L6.088 8.916a1 1 0 0 0-1.414 0zm6.619 6.619a1 1 0 0 0 0 1.415l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.415l-2.377-2.376a1 1 0 0 0-1.414 0zm0-13.238a1 1 0 0 0 0 1.414l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z'/%3E%3C/svg%3E"

export const usePriceBadge = () => {
  const nodePricing = useNodePricing()

  function updateSubgraphCredits(node: LGraphNode) {
    if (!node.isSubgraphNode()) return
    node.badges = node.badges.filter((b) => !isCreditsBadge(b))
    const innerCreditsBadges = collectCreditsBadges(node.subgraph)
    if (innerCreditsBadges.length > 1) {
      node.badges.push(
        getCreditsBadge('Partner Nodes x ' + innerCreditsBadges.length)
      )
    } else if (innerCreditsBadges.length === 1) {
      const innerApiNodes = collectInnerApiNodes(node.subgraph)
      // When a single inner api node is the price source, swap its static
      // getter for a wrapper-aware one that resolves promoted widget values.
      if (innerApiNodes.length === 1) {
        node.badges.push(buildWrapperAwarePriceBadge(node, innerApiNodes[0]))
      } else {
        node.badges.push(...innerCreditsBadges)
      }
    }
    const graph = node.graph
    if (!graph) return
    graph.trigger('node:property:changed', {
      type: 'node:property:changed',
      nodeId: node.id,
      property: 'badges',
      oldValue: node.badges,
      newValue: node.badges
    })
  }

  function collectCreditsBadges(
    graph: LGraph,
    visited: Set<string> = new Set()
  ): (LGraphBadge | (() => LGraphBadge))[] {
    if (visited.has(graph.id)) return []
    visited.add(graph.id)
    const badges: (LGraphBadge | (() => LGraphBadge))[] = []
    for (const node of graph.nodes) {
      badges.push(
        ...(node.isSubgraphNode()
          ? collectCreditsBadges(node.subgraph, visited)
          : node.badges.filter((b) => isCreditsBadge(b)))
      )
    }
    return badges
  }

  function collectInnerApiNodes(
    graph: LGraph,
    visited: Set<string> = new Set()
  ): LGraphNode[] {
    if (visited.has(graph.id)) return []
    visited.add(graph.id)
    const apiNodes: LGraphNode[] = []
    for (const node of graph.nodes) {
      if (node.isSubgraphNode()) {
        apiNodes.push(...collectInnerApiNodes(node.subgraph, visited))
      } else if (node.constructor?.nodeData?.api_node) {
        apiNodes.push(node)
      }
    }
    return apiNodes
  }

  function buildWrapperAwarePriceBadge(
    wrapper: LGraphNode,
    innerNode: LGraphNode
  ): () => LGraphBadge {
    return () =>
      getCreditsBadge(
        nodePricing.getNodeDisplayPrice(
          innerNode,
          collectPromotedOverrides(wrapper, innerNode)
        )
      )
  }

  function collectPromotedOverrides(
    wrapper: LGraphNode,
    innerNode: LGraphNode
  ): ReadonlyMap<string, unknown> {
    const overrides = new Map<string, unknown>()
    if (!wrapper.isSubgraphNode()) return overrides

    for (const input of wrapper.inputs as LinkedWidgetInput[]) {
      if (!input.widgetId) continue
      for (const linkId of input._subgraphSlot?.linkIds ?? []) {
        const link = wrapper.subgraph.getLink(linkId)
        if (link?.target_id !== innerNode.id) continue
        const targetInput = innerNode.inputs[link.target_slot]
        const widgetName = targetInput?.widget?.name
        if (!widgetName) continue
        overrides.set(
          widgetName,
          useWidgetValueStore().getWidget(input.widgetId)?.value
        )
      }
    }
    return overrides
  }

  function isCreditsBadge(
    badge: Partial<LGraphBadge> | (() => Partial<LGraphBadge>)
  ): boolean {
    const badgeInstance = typeof badge === 'function' ? badge() : badge
    return badgeInstance.icon?.image === componentIconSvg
  }

  const colorPaletteStore = useColorPaletteStore()
  function getCreditsBadge(price: string): LGraphBadge {
    const isLightTheme = colorPaletteStore.completedActivePalette.light_theme

    return new LGraphBadge({
      text: price,
      iconOptions: {
        image: componentIconSvg,
        size: 8
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
    isCreditsBadge,
    updateSubgraphCredits
  }
}
export const useCreditsBadgesInGraph = createSharedComposable(() => {
  const { isCreditsBadge } = usePriceBadge()
  const nodeTrigger = ref(0)
  app.graph.onNodeAdded = useChainCallback(
    app.graph.onNodeAdded,
    () => nodeTrigger.value++
  )
  app.graph.onNodeRemoved = useChainCallback(
    app.graph.onNodeRemoved,
    () => nodeTrigger.value++
  )
  return computed(() => {
    void nodeTrigger.value
    return mapAllNodes(app.graph, (node) => {
      if (node.isSubgraphNode()) return

      const priceBadge = node.badges.find(isCreditsBadge)
      if (!priceBadge) return

      trackNodePrice(node)
      return [node.title, toValue(priceBadge).text, node.id] as const
    })
  })
})
