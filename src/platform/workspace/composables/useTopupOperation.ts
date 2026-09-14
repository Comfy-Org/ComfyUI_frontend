import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useBillingSdkStore } from '@/platform/workspace/billing/sdk/billingSdkStore'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

/**
 * The top-up operation the dialog reads, from whichever rail observes it.
 * The rail is fixed when the dialog opens: a flag flip mid-operation must not
 * move a live operation between two observers.
 */
export function useTopupOperation() {
  const { flags } = useFeatureFlags()
  const sdkStore = flags.billingSdkTopupEnabled ? useBillingSdkStore() : null
  const operationStore = useBillingOperationStore()

  const isAddingCredits = computed(() =>
    sdkStore ? sdkStore.isAddingCredits : operationStore.isAddingCredits
  )
  const topupOperation = computed(() =>
    sdkStore
      ? sdkStore.topupActionOperation
      : operationStore.topupActionOperation
  )

  function retryPaymentAuthentication(operationId: string): Promise<boolean> {
    return sdkStore
      ? sdkStore.retryPaymentAuthentication(operationId)
      : operationStore.retryPaymentAuthentication(operationId)
  }

  function dismissOperation(operationId: string): void {
    if (sdkStore) sdkStore.dismissOperation(operationId)
    else operationStore.dismissOperation(operationId)
  }

  return {
    isAddingCredits,
    topupOperation,
    retryPaymentAuthentication,
    dismissOperation
  }
}
