import { useEventListener } from '@vueuse/core'
import { onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { ApiNodeCostEstimate } from '@comfyorg/shared-frontend-utils/nodePricing'

import { api } from '@/scripts/api'
import { useNodePricing } from '@/composables/node/useNodePricing'
import { app } from '@/scripts/app'

/**
 * The api-node cost of running the graph the user is being asked to approve.
 *
 * Only the live canvas graph can be priced: the pricing rules read widget and
 * link state off `LGraphNode`, and an ask for a workflow that is not open has
 * no such state here. So an estimate is produced only while the asked-for
 * workflow is the one on canvas, and `null` otherwise — a wrong workflow's
 * total is worse than no total.
 */
export function useRunCostEstimate(
  isEstimable: Readonly<Ref<boolean>>
): Readonly<Ref<ApiNodeCostEstimate | null>> {
  const { estimateGraphRunCost } = useNodePricing()
  const estimate = ref<ApiNodeCostEstimate | null>(null)
  let generation = 0

  async function read(): Promise<void> {
    if (!isEstimable.value) {
      estimate.value = null
      return
    }
    const mine = ++generation
    try {
      const next = await estimateGraphRunCost(app.graph)
      // A later read already answered: its figure is the current graph's.
      if (mine === generation) estimate.value = next
    } catch {
      if (mine === generation) estimate.value = null
    }
  }

  onMounted(read)
  watch(isEstimable, read)
  // The user can still edit while the card waits, and an edit can change the
  // price (a resolution widget, a connected optional input).
  useEventListener(api, 'graphChanged', read)

  return estimate
}
