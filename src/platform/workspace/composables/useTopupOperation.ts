import { computed } from 'vue'

import type { BillingClient } from '@comfyorg/account-core/billing'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import type { CreateTopupResponse } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useBillingSdkStore } from '@/platform/workspace/billing/sdk/billingSdkStore'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

/**
 * The top-up purchase and the operation the dialog reads, from one rail.
 * The rail is fixed when the dialog opens: a flag flip mid-operation must not
 * issue on one rail and observe on the other, or move a live operation
 * between two observers.
 */
export function useTopupOperation() {
  const { flags } = useFeatureFlags()
  const sdkStore = flags.billingSdkTopupRailEnabled
    ? useBillingSdkStore()
    : null
  const operationStore = useBillingOperationStore()
  const billingContext = useBillingContext()
  const billingClient: BillingClient = sdkStore ? 'sdk' : 'legacy'

  const isAddingCredits = computed(() =>
    sdkStore ? sdkStore.isAddingCredits : operationStore.isAddingCredits
  )
  const topupOperation = computed(() =>
    sdkStore
      ? sdkStore.topupActionOperation
      : operationStore.topupActionOperation
  )

  function topup(amountCents: number): Promise<CreateTopupResponse | void> {
    if (sdkStore) return sdkStore.createTopup(amountCents)
    return billingContext.topup(amountCents)
  }

  /** The Stripe-hosted Checkout URL for a one-off purchase of `amountCents`. */
  async function createHostedCheckout(
    amountCents: number,
    returnUrl: string
  ): Promise<string> {
    if (sdkStore) {
      return sdkStore.createHostedTopupCheckout(amountCents, returnUrl)
    }
    const { checkout_url } = await workspaceApi.createTopupCheckout(
      amountCents,
      returnUrl
    )
    return checkout_url
  }

  function dismissOperation(operationId: string): void {
    if (sdkStore) sdkStore.dismissOperation(operationId)
    else operationStore.dismissOperation(operationId)
  }

  /**
   * Adopt a top-up the purchase left pending, so the caller is told when it
   * settles. On the SDK rail the lifecycle adopted it when the command was
   * issued, so there is nothing to register and a second registration would be
   * a second poller on one operation.
   */
  async function adoptPendingOperation(
    operationId: string,
    metadata: {
      attemptStartedAt: number
      paymentIntentSource?: PaymentIntentSource
    }
  ): Promise<void> {
    if (sdkStore) return
    await operationStore.startOperation(operationId, 'topup', metadata)
  }

  return {
    billingClient,
    isAddingCredits,
    topupOperation,
    topup,
    createHostedCheckout,
    dismissOperation,
    adoptPendingOperation
  }
}
