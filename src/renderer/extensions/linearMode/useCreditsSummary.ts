import { computed, toValue } from 'vue'

import { usePriceBadge } from '@/composables/node/usePriceBadge'
import { trackNodePrice } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'
import { mapAllNodes } from '@/utils/graphTraversalUtil'

export interface CreditBadge {
  title: string
  price: string
  nodeId: NodeId
}

/**
 * Collects the credit-cost badges of every priced node in the active graph,
 * feeding both the run/subscribe button pill and the breakdown popover.
 */
export function useCreditsSummary() {
  const { isCreditsBadge } = usePriceBadge()

  const creditsBadges = computed<CreditBadge[]>(() => {
    if (!app.isGraphReady) return []

    return mapAllNodes(app.graph, (node) => {
      if (node.isSubgraphNode()) return

      const priceBadge = node.badges.find(isCreditsBadge)
      if (!priceBadge) return

      trackNodePrice(node)
      return {
        title: node.title,
        price: toValue(priceBadge).text,
        nodeId: node.id
      }
    })
  })

  return { creditsBadges }
}
