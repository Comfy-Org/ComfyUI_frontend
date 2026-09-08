import { useAsyncState } from '@vueuse/core'
import { computed } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

/**
 * Reports whether the active workspace has a usable (default) saved payment
 * method — the same predicate the top-up endpoint enforces. It is `null`
 * until the lookup resolves, and stays `null` when it fails so callers can
 * withhold payment-method claims instead of asserting one.
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
    state.value === null
      ? null
      : state.value.some((method) => method.is_default)
  )
  return { hasSavedPaymentMethod, error, isLoading, isReady, refresh: execute }
}
