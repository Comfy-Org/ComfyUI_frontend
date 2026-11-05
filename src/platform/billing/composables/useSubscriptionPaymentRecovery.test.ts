import type { SubscriptionPaymentRecovery } from '@comfyorg/ingest-types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, shallowRef } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { billingApi } from '@/platform/billing/api/billingApi'
import type { BillingTab } from '@/platform/billing/billingTab'
import { reserveBillingTab } from '@/platform/billing/billingTab'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useSubscriptionPaymentRecovery } from '@/platform/billing/composables/useSubscriptionPaymentRecovery'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'

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

function toastKinds() {
  return useToast().toasts.map((toast) => toast.kind)
}

describe('useSubscriptionPaymentRecovery', () => {
  beforeEach(() => {
    vi.mocked(billingApi.getBillingOpStatus).mockResolvedValue({
      id: SIGNUP_OP,
      started_at: '2026-11-05T17:15:54Z',
      status: 'pending',
      action_url: INVOICE_URL
    })
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
    await refresh()

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

  it('keeps the return refresh armed after the pricing dialog closes', async () => {
    const context = serveRecovery(true)
    vi.mocked(reserveBillingTab).mockReturnValue(trackedTab())
    const stopRefresh = vi.fn()
    vi.mocked(registerRefreshOnReturn).mockReturnValue(stopRefresh)
    const scope = effectScope()

    await scope.run(() => useSubscriptionPaymentRecovery())?.finishPayment()
    scope.stop()
    const [refresh] = vi.mocked(registerRefreshOnReturn).mock.calls[0]
    await refresh()

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

  it('leaves the plan unnamed when the operation read fails', async () => {
    serveRecovery(true)
    const failure = new Error('network down')
    vi.mocked(billingApi.getBillingOpStatus).mockRejectedValue(failure)

    const { recoveryPlanTier } = useSubscriptionPaymentRecovery()

    await vi.waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({
          errorType: 'error_reading_signup_payment_recovery_plan'
        })
      )
    )
    expect(recoveryPlanTier.value).toBeNull()
  })

  it('does nothing when the server serves no recovery', async () => {
    serveRecovery(false)

    await useSubscriptionPaymentRecovery().finishPayment()

    expect(reserveBillingTab).not.toHaveBeenCalled()
    expect(billingApi.getBillingOpStatus).not.toHaveBeenCalled()
  })
})
