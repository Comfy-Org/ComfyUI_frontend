import type { SubscriptionPaymentRecovery } from '@comfyorg/account-core/billing'
import { reportError } from '@comfyorg/telemetry/reportError'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import type { Mock } from 'vitest'
import { computed, effectScope, nextTick, shallowRef } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { billingApi } from '@/platform/billing/api/billingApi'
import type { BillingTab } from '@/platform/billing/billingTab'
import { reserveBillingTab } from '@/platform/billing/billingTab'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useSubscriptionPaymentRecovery } from '@/platform/billing/composables/useSubscriptionPaymentRecovery'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/platform/billing/api/billingApi'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/billingTab'), () => ({
  reserveBillingTab: vi.fn()
}))
vi.mock(import('@/platform/billing/refreshOnReturn'), () => ({
  registerRefreshOnReturn: vi.fn(() => () => {})
}))

const SIGNUP_OP = 'op-signup'
const INVOICE_URL = 'https://invoice.stripe.example/i/signup'
const PENDING_SIGNUP_OPERATION: Awaited<
  ReturnType<typeof billingApi.getBillingOpStatus>
> = {
  id: SIGNUP_OP,
  started_at: '2026-11-05T17:15:54Z',
  status: 'pending',
  action_url: INVOICE_URL
}

const SECRET_ONLY_SIGNUP_OPERATION: Awaited<
  ReturnType<typeof billingApi.getBillingOpStatus>
> = {
  id: SIGNUP_OP,
  started_at: '2026-11-05T17:15:54Z',
  status: 'pending',
  payment_intent_client_secret: 'pi_signup_secret',
  plan: { slug: 'creator-monthly', duration: 'MONTHLY', tier: 'CREATOR' }
}

function serveBillingWebDestination() {
  remoteConfig.value = {
    hosted_billing_destination: 'billing_web',
    billing_web_url: 'https://billing.comfy.org'
  }
  onTestFinished(() => {
    remoteConfig.value = {}
  })
}

function trackedTab(): BillingTab & { opened: string[]; closed: boolean } {
  const tab = {
    opened: [] as string[],
    closed: false,
    navigate: (url: string) => {
      tab.opened.push(url)
    },
    close: () => {
      tab.closed = true
    }
  }
  return tab
}

function serveRecovery(served: boolean) {
  const context = useBillingContext()
  context.subscriptionPaymentRecovery = computed(() =>
    served ? { billing_op_id: SIGNUP_OP, reason: 'payment_required' } : null
  )
  vi.mocked(useBillingContext).mockReturnValue(context)
  return context
}

function serveLiveRecovery() {
  const recovery = shallowRef<SubscriptionPaymentRecovery | null>({
    billing_op_id: SIGNUP_OP,
    reason: 'payment_required'
  })
  const context = useBillingContext()
  context.subscriptionPaymentRecovery = computed(() => recovery.value)
  vi.mocked(useBillingContext).mockReturnValue(context)
  return recovery
}

function trackArmedReturnRefreshes() {
  const stops: Mock<() => void>[] = []
  vi.mocked(registerRefreshOnReturn).mockImplementation(() => {
    const stop = vi.fn<() => void>()
    stops.push(stop)
    return stop
  })
  return () => stops.filter((stop) => stop.mock.calls.length === 0).length
}

function openPricingDialog() {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const dialog = scope.run(() => useSubscriptionPaymentRecovery())
  if (!dialog) throw new Error('pricing dialog scope did not run')
  return { finishPayment: dialog.finishPayment, close: () => scope.stop() }
}

async function payFromClosedDialogs(attempts: number) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const dialog = openPricingDialog()
    await dialog.finishPayment()
    dialog.close()
  }
}

function deferNextOperationLookup() {
  let settle = () => {}
  vi.mocked(billingApi.getBillingOpStatus).mockReturnValueOnce(
    new Promise((resolve) => {
      settle = () => resolve(PENDING_SIGNUP_OPERATION)
    })
  )
  return () => settle()
}

function toastKinds() {
  return useToast().toasts.map((toast) => toast.kind)
}

describe('useSubscriptionPaymentRecovery', () => {
  beforeEach(() => {
    vi.mocked(billingApi.getBillingOpStatus).mockResolvedValue(
      PENDING_SIGNUP_OPERATION
    )
  })

  it('opens the served invoice payment page for the bound signup operation', async () => {
    serveRecovery(true)
    const tab = trackedTab()
    vi.mocked(reserveBillingTab).mockReturnValue(tab)

    await useSubscriptionPaymentRecovery().finishPayment()

    expect(billingApi.getBillingOpStatus).toHaveBeenCalledWith(SIGNUP_OP)
    expect(tab.opened).toEqual([INVOICE_URL])
    expect(tab.closed).toBe(false)
    expect(toastKinds()).toEqual([])
  })

  it('re-reads plans, status and capabilities when the customer returns from paying', async () => {
    const context = serveRecovery(true)
    vi.mocked(reserveBillingTab).mockReturnValue(trackedTab())

    await useSubscriptionPaymentRecovery().finishPayment()
    const [refresh] = vi.mocked(registerRefreshOnReturn).mock.calls[0]
    await refresh(new Event('focus'))

    expect(context.fetchPlans).toHaveBeenCalledOnce()
    expect(context.fetchStatus).toHaveBeenCalledOnce()
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
  })

  it('disarms the return refresh once the server stops serving the recovery', async () => {
    const recovery = shallowRef<SubscriptionPaymentRecovery | null>({
      billing_op_id: SIGNUP_OP,
      reason: 'payment_required'
    })
    const context = useBillingContext()
    context.subscriptionPaymentRecovery = computed(() => recovery.value)
    vi.mocked(useBillingContext).mockReturnValue(context)
    vi.mocked(reserveBillingTab).mockReturnValue(trackedTab())
    const stopRefresh = vi.fn()
    vi.mocked(registerRefreshOnReturn).mockReturnValue(stopRefresh)

    await useSubscriptionPaymentRecovery().finishPayment()
    recovery.value = null
    await nextTick()

    expect(stopRefresh).toHaveBeenCalledOnce()
  })

  it('keeps the refresh armed from the plans copy when a surface reading the status copy is served no recovery', async () => {
    serveRecovery(true)
    vi.mocked(reserveBillingTab).mockReturnValue(trackedTab())
    const stopRefresh = vi.fn()
    vi.mocked(registerRefreshOnReturn).mockReturnValue(stopRefresh)

    await useSubscriptionPaymentRecovery().finishPayment()
    useSubscriptionPaymentRecovery('status')
    await nextTick()

    expect(stopRefresh).not.toHaveBeenCalled()
  })

  it('keeps the return refresh armed after the pricing dialog closes while the payment stays pending', async () => {
    const context = serveRecovery(true)
    vi.mocked(reserveBillingTab).mockReturnValue(trackedTab())
    const stopRefresh = vi.fn()
    vi.mocked(registerRefreshOnReturn).mockReturnValue(stopRefresh)
    const scope = effectScope()

    await scope.run(() => useSubscriptionPaymentRecovery())?.finishPayment()
    scope.stop()
    const [refresh] = vi.mocked(registerRefreshOnReturn).mock.calls[0]
    await refresh(new Event('focus'))

    expect(stopRefresh).not.toHaveBeenCalled()
    expect(context.fetchPlans).toHaveBeenCalledOnce()
    expect(context.fetchStatus).toHaveBeenCalledOnce()
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
  })

  it('closes the tab and re-reads billing when the operation no longer has a payment page', async () => {
    const context = serveRecovery(true)
    const tab = trackedTab()
    vi.mocked(reserveBillingTab).mockReturnValue(tab)
    vi.mocked(billingApi.getBillingOpStatus).mockResolvedValue({
      id: SIGNUP_OP,
      started_at: '2026-11-05T17:15:54Z',
      status: 'succeeded'
    })

    await useSubscriptionPaymentRecovery().finishPayment()

    expect(tab.closed).toBe(true)
    expect(tab.opened).toEqual([])
    expect(toastKinds()).toEqual(['error'])
    expect(context.fetchPlans).toHaveBeenCalledOnce()
  })

  it('closes the tab and reports a failed operation read', async () => {
    serveRecovery(true)
    const tab = trackedTab()
    vi.mocked(reserveBillingTab).mockReturnValue(tab)
    const failure = new Error('network down')
    vi.mocked(billingApi.getBillingOpStatus).mockRejectedValue(failure)

    await useSubscriptionPaymentRecovery().finishPayment()

    expect(tab.closed).toBe(true)
    expect(reportError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({
        errorType: 'error_reading_signup_payment_recovery_action'
      })
    )
    expect(toastKinds()).toEqual(['error'])
  })

  it('warns about a blocked popup and opens nothing', async () => {
    serveRecovery(true)
    vi.mocked(reserveBillingTab).mockReturnValue(null)

    await useSubscriptionPaymentRecovery().finishPayment()

    expect(registerRefreshOnReturn).not.toHaveBeenCalled()
    expect(toastKinds()).toEqual(['warning'])
  })

  it('names the plan the bound signup operation targets', async () => {
    serveRecovery(true)
    vi.mocked(billingApi.getBillingOpStatus).mockResolvedValue({
      id: SIGNUP_OP,
      started_at: '2026-11-05T17:15:54Z',
      status: 'pending',
      plan: { slug: 'creator-monthly', duration: 'MONTHLY', tier: 'CREATOR' }
    })

    const { recoveryPlanTier } = useSubscriptionPaymentRecovery()

    await vi.waitFor(() => expect(recoveryPlanTier.value).toBe('CREATOR'))
    expect(billingApi.getBillingOpStatus).toHaveBeenCalledWith(SIGNUP_OP)
  })

  it('reads the payment page as loading until the bound signup operation serves a hosted page', async () => {
    serveRecovery(true)

    const { recoveryPaymentPage } = useSubscriptionPaymentRecovery()

    expect(recoveryPaymentPage.value).toEqual({ kind: 'loading' })
    await vi.waitFor(() =>
      expect(recoveryPaymentPage.value).toEqual({ kind: 'hostedPage' })
    )
  })

  it('links billing-web checkout for the served plan when the operation serves only a client secret', async () => {
    serveRecovery(true)
    serveBillingWebDestination()
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-signup' })
    vi.mocked(billingApi.getBillingOpStatus).mockResolvedValue(
      SECRET_ONLY_SIGNUP_OPERATION
    )

    const { recoveryPaymentPage } = useSubscriptionPaymentRecovery()

    await vi.waitFor(() =>
      expect(recoveryPaymentPage.value).toEqual({
        kind: 'clientSecretOnly',
        checkoutUrl:
          'https://billing.comfy.org/v1/checkout?product=comfyui&return_to=comfyui_workspace&plan=creator-monthly&workspace=ws-signup&operation=op-signup'
      })
    )
  })

  it('re-reads plans, status and capabilities when the customer returns from the billing-web verification', async () => {
    const context = serveRecovery(true)

    useSubscriptionPaymentRecovery().refreshOnVerificationReturn()
    const [refresh] = vi.mocked(registerRefreshOnReturn).mock.calls[0]
    await refresh(new Event('focus'))

    expect(context.fetchPlans).toHaveBeenCalledOnce()
    expect(context.fetchStatus).toHaveBeenCalledOnce()
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
  })

  it('reads the payment page as unavailable when billing-web is not the hosted destination for a client-secret-only operation', async () => {
    serveRecovery(true)
    vi.mocked(billingApi.getBillingOpStatus).mockResolvedValue(
      SECRET_ONLY_SIGNUP_OPERATION
    )

    const { recoveryPlanTier, recoveryPaymentPage } =
      useSubscriptionPaymentRecovery()

    await vi.waitFor(() => expect(recoveryPlanTier.value).toBe('CREATOR'))
    expect(recoveryPaymentPage.value).toEqual({ kind: 'unavailable' })
  })

  it('links billing-web checkout once billing-web becomes the hosted destination for the same client-secret-only operation', async () => {
    serveRecovery(true)
    vi.mocked(billingApi.getBillingOpStatus).mockResolvedValue(
      SECRET_ONLY_SIGNUP_OPERATION
    )

    const { recoveryPlanTier, recoveryPaymentPage } =
      useSubscriptionPaymentRecovery()
    await vi.waitFor(() => expect(recoveryPlanTier.value).toBe('CREATOR'))
    serveBillingWebDestination()

    expect(recoveryPaymentPage.value).toMatchObject({
      kind: 'clientSecretOnly'
    })
    expect(billingApi.getBillingOpStatus).toHaveBeenCalledOnce()
  })

  it('leaves the plan unnamed and the payment page unavailable when the operation read fails', async () => {
    serveRecovery(true)
    const failure = new Error('network down')
    vi.mocked(billingApi.getBillingOpStatus).mockRejectedValue(failure)

    const { recoveryPlanTier, recoveryPaymentPage } =
      useSubscriptionPaymentRecovery()

    await vi.waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({
          errorType: 'error_reading_signup_payment_recovery_plan'
        })
      )
    )
    expect(recoveryPlanTier.value).toBeNull()
    expect(recoveryPaymentPage.value).toEqual({ kind: 'unavailable' })
  })

  it('does nothing when the server serves no recovery', async () => {
    serveRecovery(false)

    await useSubscriptionPaymentRecovery().finishPayment()

    expect(reserveBillingTab).not.toHaveBeenCalled()
    expect(billingApi.getBillingOpStatus).not.toHaveBeenCalled()
  })
})

describe('useSubscriptionPaymentRecovery return refresh across pricing dialogs', () => {
  beforeEach(() => {
    vi.mocked(billingApi.getBillingOpStatus).mockResolvedValue(
      PENDING_SIGNUP_OPERATION
    )
    vi.mocked(reserveBillingTab).mockImplementation(trackedTab)
  })

  it('keeps one return refresh armed when pricing is reopened to pay again and again', async () => {
    serveRecovery(true)
    const armedReturnRefreshes = trackArmedReturnRefreshes()

    await payFromClosedDialogs(3)

    expect(registerRefreshOnReturn).toHaveBeenCalledTimes(3)
    expect(armedReturnRefreshes()).toBe(1)
  })

  it('disarms every return refresh once the latest open dialog stops being served the recovery', async () => {
    const recovery = serveLiveRecovery()
    const armedReturnRefreshes = trackArmedReturnRefreshes()
    await payFromClosedDialogs(2)
    const latest = openPricingDialog()
    await latest.finishPayment()

    recovery.value = null
    await nextTick()

    expect(armedReturnRefreshes()).toBe(0)
  })

  it('disarms a closed dialog return refresh when pricing reopens after the recovery cleared', async () => {
    const recovery = serveLiveRecovery()
    const armedReturnRefreshes = trackArmedReturnRefreshes()
    const closed = openPricingDialog()
    await closed.finishPayment()
    closed.close()
    recovery.value = null

    openPricingDialog()

    expect(armedReturnRefreshes()).toBe(0)
  })

  it('drops a plans payment whose recovery cleared while its operation loaded, keeping the status refresh', async () => {
    const plansRecovery = serveLiveRecovery()
    const context = useBillingContext()
    context.statusPaymentRecovery = computed(() => ({
      billing_op_id: SIGNUP_OP,
      reason: 'payment_required'
    }))
    vi.mocked(useBillingContext).mockReturnValue(context)
    const armedReturnRefreshes = trackArmedReturnRefreshes()
    const pricing = openPricingDialog()
    const settlePricing = deferNextOperationLookup()
    const pricingPaying = pricing.finishPayment()
    const tab = vi.mocked(reserveBillingTab).mock.results.at(-1)?.value
    await useSubscriptionPaymentRecovery('status').finishPayment()

    plansRecovery.value = null
    await nextTick()
    settlePricing()
    await pricingPaying

    expect(tab).toMatchObject({ opened: [], closed: true })
    expect(registerRefreshOnReturn).toHaveBeenCalledOnce()
    expect(armedReturnRefreshes()).toBe(1)
  })

  it.for([
    {
      settles: 'the closed dialog lookup',
      first: 'closed',
      second: 'reopened'
    },
    {
      settles: 'the reopened dialog lookup',
      first: 'reopened',
      second: 'closed'
    }
  ] as const)(
    'keeps one return refresh armed when $settles settles first across a reopen',
    async ({ first, second }) => {
      serveRecovery(true)
      const armedReturnRefreshes = trackArmedReturnRefreshes()
      const closed = openPricingDialog()
      const settleClosed = deferNextOperationLookup()
      const closedPaying = closed.finishPayment()
      closed.close()
      const reopened = openPricingDialog()
      const settleReopened = deferNextOperationLookup()
      const reopenedPaying = reopened.finishPayment()
      const attempts = {
        closed: { settle: settleClosed, paying: closedPaying },
        reopened: { settle: settleReopened, paying: reopenedPaying }
      }

      attempts[first].settle()
      await attempts[first].paying
      attempts[second].settle()
      await attempts[second].paying

      expect(registerRefreshOnReturn).toHaveBeenCalledTimes(2)
      expect(armedReturnRefreshes()).toBe(1)
    }
  )
})
