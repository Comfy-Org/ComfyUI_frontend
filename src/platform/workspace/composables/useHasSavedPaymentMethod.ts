import { ref } from 'vue'

import { workspaceApi } from '@/platform/workspace/api/workspaceApi'

/**
 * Reports whether the active workspace has a saved payment method.
 * `null` until the lookup resolves, and stays `null` when it fails so
 * callers fall back to their default copy instead of claiming certainty.
 */
export function useHasSavedPaymentMethod() {
  const hasSavedPaymentMethod = ref<boolean | null>(null)
  void workspaceApi
    .listSavedPaymentMethods()
    .then((methods) => {
      hasSavedPaymentMethod.value = methods.length > 0
    })
    .catch(() => {
      hasSavedPaymentMethod.value = null
    })
  return { hasSavedPaymentMethod }
}
