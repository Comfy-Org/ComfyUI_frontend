import { delay } from 'es-toolkit'
import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { billingApi } from '@/platform/billing/api/billingApi'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
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
 * The top-up quote, checkout session and operation the dialog reads, from one rail.
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
  const topupOperation = computed(() =>
    sdkStore
      ? sdkStore.topupActionOperation
      : operationStore.topupActionOperation
  )

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
    const { checkout_url } = await billingApi.createTopupCheckout(
      amountCents,
      returnUrl,
      signal
    )
    return checkout_url
  }

  async function quoteTopup(
    amountCents: number,
    signal: AbortSignal
  ): Promise<number | null> {
    if (sdkStore) return sdkStore.quoteTopup(amountCents, signal)
    try {
      return (await billingApi.quoteTopup(amountCents, signal)).credits
    } catch {
      return null
    }
  }

  return {
    topupOperation,
    createHostedCheckout,
    quoteTopup
  }
}
