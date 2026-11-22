import { useEventListener } from '@vueuse/core'
import { onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { ApiNodeCostEstimate } from '@comfyorg/shared-frontend-utils/nodePricing'

import { api } from '@/scripts/api'
import { useNodePricing } from '@/composables/node/useNodePricing'
import { useApp } from '@/scripts/appInstance'

/** The api-node cost of the graph on canvas, or null while it is not estimable. */
export function useRunCostEstimate(
  isEstimable: Readonly<Ref<boolean>>
): Readonly<Ref<ApiNodeCostEstimate | null>> {
  const { estimateGraphRunCost } = useNodePricing()
  const estimate = ref<ApiNodeCostEstimate | null>(null)
  let generation = 0

  async function read(): Promise<void> {
    const mine = ++generation
    if (!isEstimable.value) {
      estimate.value = null
      return
    }
    try {
      const next = await estimateGraphRunCost(useApp().graph)
      if (mine === generation) estimate.value = next
    } catch {
      if (mine === generation) estimate.value = null
    }
  }

  onMounted(read)
  watch(isEstimable, read)
  useEventListener(api, 'graphChanged', read)

  return estimate
}
