import { useAsyncState } from '@vueuse/core'
import { computed } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

/**
 * Reports whether the active workspace has a saved payment method.
 * `hasSavedPaymentMethod` is `null` until the lookup resolves, and stays
 * `null` when it fails so callers fall back to their default copy instead
 * of claiming certainty.
 */
export function useHasSavedPaymentMethod() {
  const { state, error, isLoading, isReady, execute } = useAsyncState(
    () => workspaceApi.listSavedPaymentMethods(),
    null,
    {
      onError: (lookupError) =>
        reportError(lookupError, {
          errorType: 'saved_payment_methods_read_failure'
        })
    }
  )
  const hasSavedPaymentMethod = computed(() =>
    state.value === null ? null : state.value.length > 0
  )
  return { hasSavedPaymentMethod, error, isLoading, isReady, refresh: execute }
}
