import { useEventListener } from '@vueuse/core'
import { onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'

import type { ApiNodeCostEstimate } from '@comfyorg/shared-frontend-utils/nodePricing'

import { api } from '@/scripts/api'
import { useNodePricing } from '@/composables/node/useNodePricing'
import { useApp } from '@/scripts/appInstance'

export type RunCostEstimateState =
  | { status: 'idle' }
  | { status: 'available'; estimate: ApiNodeCostEstimate }
  | { status: 'unavailable' }

/** The api-node cost state of the graph on canvas. */
export function useRunCostEstimate(
  isEstimable: Readonly<Ref<boolean>>
): Readonly<Ref<RunCostEstimateState>> {
  const { estimateGraphRunCost } = useNodePricing()
  const state = ref<RunCostEstimateState>({ status: 'idle' })
  let generation = 0

  async function read(): Promise<void> {
    const mine = ++generation
    if (!isEstimable.value) {
      state.value = { status: 'idle' }
      return
    }
    try {
      const next = await estimateGraphRunCost(useApp().graph)
      if (mine === generation) {
        state.value = { status: 'available', estimate: next }
      }
    } catch (cause) {
      reportError(cause, {
        surface: 'agent',
        errorType: 'run_cost_estimate_failed'
      })
      if (mine === generation) state.value = { status: 'unavailable' }
    }
  }

  onMounted(read)
  watch(isEstimable, read)
  useEventListener(api, 'graphChanged', read)

  return state
}
