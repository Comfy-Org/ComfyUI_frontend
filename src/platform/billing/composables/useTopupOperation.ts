import { delay } from 'es-toolkit'
import { computed } from 'vue'

import type { BillingClient } from '@comfyorg/account-core/billing'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { PaymentIntentSource } from '@/platform/telemetry/types'
import type { CreateTopupResponse } from '@/platform/workspace/api/workspaceApi'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { useBillingSdkStore } from '@/platform/billing/sdk/billingSdkStore'
import { useBillingOperationStore } from '@/platform/billing/stores/billingOperationStore'

const RETRYABLE_CHECKOUT_REFUSALS: ReadonlyArray<readonly [number, string]> = [
  [409, 'TOPUP_CHECKOUT_BUSY'],
  [409, 'TOPUP_CHECKOUT_NOT_PAYABLE'],
  [503, 'TOPUP_CHECKOUT_UNAVAILABLE']
]

const CHECKOUT_RETRY_DELAYS_MS = [1000, 2000]

function isRetryableCheckoutRefusal(error: unknown): boolean {
  return (
    error instanceof WorkspaceApiError &&
    RETRYABLE_CHECKOUT_REFUSALS.some(
      ([status, code]) => error.status === status && error.code === code
    )
  )
}

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

  async function createHostedCheckout(
    amountCents: number,
    returnUrl: string,
    signal?: AbortSignal
  ): Promise<string> {
    for (const retryDelayMs of CHECKOUT_RETRY_DELAYS_MS) {
      try {
        return await mintHostedCheckout(amountCents, returnUrl, signal)
      } catch (error) {
        if (!isRetryableCheckoutRefusal(error)) throw error
        await delay(retryDelayMs, { signal })
      }
    }
    return mintHostedCheckout(amountCents, returnUrl, signal)
  }

  async function mintHostedCheckout(
    amountCents: number,
    returnUrl: string,
    signal: AbortSignal | undefined
  ): Promise<string> {
    if (sdkStore) {
      return sdkStore.createHostedTopupCheckout(amountCents, returnUrl, signal)
    }
    const { checkout_url } = await workspaceApi.createTopupCheckout(
      amountCents,
      returnUrl,
      signal
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
