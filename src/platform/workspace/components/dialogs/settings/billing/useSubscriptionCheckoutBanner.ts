import type {
  BillingOpReceiptPlan,
  BillingOpStatusResponse
} from '@comfyorg/ingest-types'
import { useDocumentVisibility } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'

import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { reportError } from '@/platform/telemetry/reportError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import type { SubscribeResponse } from '@/platform/workspace/api/workspaceApi'
import { reserveBillingTab } from '@/platform/workspace/billing/billingTab'
import { subscriptionCheckoutBannerFor } from '@/platform/workspace/components/dialogs/settings/billing/subscriptionCheckoutBanner'

type CheckoutLaunch =
  | { state: 'idle' }
  | { state: 'opening' }
  | { state: 'blocked'; opId: string; url: string }
  | { state: 'failed'; opId: string }

async function readSubscriptionOperation(
  previous: BillingOpStatusResponse | null
): Promise<BillingOpStatusResponse | null> {
  const status = await workspaceApi.getBillingStatus()
  const pendingId =
    status.pending_billing_op_type === 'topup'
      ? undefined
      : status.pending_billing_op_id
  if (pendingId) return workspaceApi.getBillingOpStatus(pendingId)
  if (previous?.status === 'pending') {
    return workspaceApi.getBillingOpStatus(previous.id)
  }
  return previous
}

async function resubmitSubscribe(
  plan: BillingOpReceiptPlan
): Promise<SubscribeResponse | null> {
  try {
    return await workspaceApi.subscribe(plan.slug, {
      teamCreditStopId: plan.team_credit_stop_id,
      returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
      cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`
    })
  } catch (error) {
    reportError(error, {
      errorType: 'subscription_checkout_reopen_failed',
      surface: 'billing'
    })
    return null
  }
}

export function useSubscriptionCheckoutBanner(
  onSubscribed: () => Promise<unknown>
) {
  const operation = shallowRef<BillingOpStatusResponse | null>(null)
  const dismissed = shallowRef<ReadonlySet<string>>(new Set())
  const launch = shallowRef<CheckoutLaunch>({ state: 'idle' })

  const banner = computed(() => {
    const shown =
      operation.value && subscriptionCheckoutBannerFor(operation.value)
    return shown && !dismissed.value.has(`${shown.opId}:${shown.kind}`)
      ? shown
      : null
  })

  async function refresh() {
    try {
      operation.value = await readSubscriptionOperation(operation.value)
    } catch (error) {
      reportError(error, {
        errorType: 'subscription_checkout_read_failed',
        surface: 'billing'
      })
    }
  }

  function dismiss() {
    if (!banner.value) return
    dismissed.value = new Set([
      ...dismissed.value,
      `${banner.value.opId}:${banner.value.kind}`
    ])
  }

  async function openCheckout(plan: BillingOpReceiptPlan, opId: string) {
    if (launch.value.state === 'opening') return
    const tab = reserveBillingTab()
    launch.value = { state: 'opening' }
    const response = await resubmitSubscribe(plan)
    if (!response) {
      tab?.close()
      launch.value = { state: 'failed', opId }
      return
    }
    const url =
      response.status === 'needs_payment_method'
        ? response.payment_method_url
        : undefined
    if (url && tab) tab.navigate(url)
    else tab?.close()
    launch.value =
      url && !tab
        ? { state: 'blocked', opId: response.billing_op_id, url }
        : { state: 'idle' }
    await Promise.allSettled([refresh(), onSubscribed()])
  }

  void refresh()
  watch(useDocumentVisibility(), (visibility) => {
    if (visibility === 'visible') void refresh()
  })

  return { banner, launch, dismiss, openCheckout }
}
