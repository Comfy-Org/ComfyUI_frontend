import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useBillingSdkStore } from '@/platform/workspace/billing/sdk/billingSdkStore'

export type HostedTopupCheckoutOutcome =
  | { readonly status: 'created'; readonly checkoutUrl: string }
  | { readonly status: 'failed'; readonly error: unknown }

/**
 * Creates the Stripe-hosted top-up checkout on one rail, fixed when the dialog
 * opens so a flag flip mid-flow cannot split one purchase across two rails.
 */
export function useTopupCheckout() {
  const { flags } = useFeatureFlags()
  const sdkStore = flags.billingSdkTopupRailEnabled
    ? useBillingSdkStore()
    : null

  async function requestCheckoutUrl(
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

  async function createHostedCheckout(
    amountCents: number,
    returnUrl: string
  ): Promise<HostedTopupCheckoutOutcome> {
    try {
      return {
        status: 'created',
        checkoutUrl: await requestCheckoutUrl(amountCents, returnUrl)
      }
    } catch (error) {
      return { status: 'failed', error }
    }
  }

  return { createHostedCheckout }
}
