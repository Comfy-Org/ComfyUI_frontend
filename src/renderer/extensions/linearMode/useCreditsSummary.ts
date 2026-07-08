import { computed, toValue } from 'vue'

import { usePriceBadge } from '@/composables/node/usePriceBadge'
import { trackNodePrice } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import { app } from '@/scripts/app'
import { mapAllNodes } from '@/utils/graphTraversalUtil'

/**
 * Collects the credit-cost badges of every priced node in the active graph.
 * Shared by the credits panel and the run/subscribe button pill so both stay
 * in sync.
 */
export function useCreditsSummary() {
  const { isCreditsBadge } = usePriceBadge()

  const creditsBadges = computed(() => {
    if (!app.isGraphReady) return []

    return mapAllNodes(app.graph, (node) => {
      if (node.isSubgraphNode()) return

      const priceBadge = node.badges.find(isCreditsBadge)
      if (!priceBadge) return

      trackNodePrice(node)
      return [node.title, toValue(priceBadge).text, node.id] as const
    })
  })

  return { creditsBadges }
}
