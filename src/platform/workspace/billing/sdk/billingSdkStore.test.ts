import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useToastStore } from '@/platform/updates/common/toastStore'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { workspaceApiUrl } from '@/platform/workspace/api/workspaceApiUrl'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { stubAccountIdentityPort } from '@/utils/__tests__/stubAccountIdentityPort'
import { useDialogStore } from '@/stores/dialogStore'

import { useBillingSdkStore } from './billingSdkStore'
import {
  fakeBillingSdk,
  failedOperation,
  failedTopup,
  pendingTopup,
  pendingSubscription,
  settledOperation,
  settledTopup
} from './billingSdkTestUtils'
import type { HostedBillingDestination } from '@comfyorg/account-core/billing'

import type { BillingSdk, BillingSdkOptions } from './createBillingSdk'

const mockCreateBillingSdk = vi.hoisted(() =>
  vi.fn<(options: BillingSdkOptions) => BillingSdk>()
)
vi.mock(import('./createBillingSdk'), () => ({
  createBillingSdk: mockCreateBillingSdk
}))

const mockFetchStatus = vi.hoisted(() => vi.fn(async () => undefined))
const mockFetchBalance = vi.hoisted(() => vi.fn(async () => undefined))
const mockReconcileSubscription = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock<unknown>(import('@/composables/billing/useBillingContext'), () => ({
  useBillingContext: () => ({
    fetchStatus: mockFetchStatus,
    fetchBalance: mockFetchBalance,
    reconcileSubscriptionSuccess: mockReconcileSubscription
  })
}))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

const mockShowSettings = vi.hoisted(() => vi.fn())
vi.mock<unknown>(
  import('@/platform/settings/composables/useSettingsDialog'),
  () => ({
    useSettingsDialog: () => ({ show: mockShowSettings })
  })
)

const mockTrackBillingEvent = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => ({ trackBillingEvent: mockTrackBillingEvent })
}))

const flagState = vi.hoisted(() => ({
  embeddedCheckoutEnabled: false,
  hostedBillingDestination: 'stripe' as HostedBillingDestination
}))
vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({
    flags: {
      get embeddedCheckoutEnabled() {
        return flagState.embeddedCheckoutEnabled
      },
      get hostedBillingDestination() {
        return flagState.hostedBillingDestination
      }
    }
  })
}))

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

vi.mock(import('firebase/auth'))

const mockLoadStripe = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@stripe/stripe-js/pure'), () => ({
  loadStripe: mockLoadStripe
}))

let harness: ReturnType<typeof fakeBillingSdk>
let options: BillingSdkOptions

beforeEach(() => {
  stubAccountIdentityPort()
  flagState.embeddedCheckoutEnabled = false
  flagState.hostedBillingDestination = 'stripe'
  harness = fakeBillingSdk()
  mockCreateBillingSdk.mockImplementation((sdkOptions) => {
    options = sdkOptions
    return harness.sdk
  })
  vi.mocked(useDialogStore().closeDialog).mockImplementation(() => {})
})

function startedEvent(resumed: boolean) {
  return {
    name: 'billing.operation.started',
    billing_op_id: 'op-1',
    operation_type: 'topup',
    presentation: 'hosted',
    resumed
  } as const
}

describe('useBillingSdkStore', () => {
  it('composes the SDK over the app session, URL resolver, and tab storage', () => {
    useBillingSdkStore()

    expect(options.session).toBe(
      useWorkspaceAuthStore().getUnifiedSessionClient()
    )
    expect(options.resolveUrl).toBe(workspaceApiUrl)
    expect(options.pointerStorage).toBe(sessionStorage)
  })

  it.for(['stripe', 'billing_web'] as const)(
    'serves the hosted page from the destination the flag names, %s',
    (destination: HostedBillingDestination) => {
      flagState.hostedBillingDestination = destination
      useBillingSdkStore()

      expect(options.hostedDestination()).toBe(destination)
    }
  )

  it('re-reads the destination flag rather than capturing it at composition', () => {
    useBillingSdkStore()

    flagState.hostedBillingDestination = 'billing_web'

    expect(options.hostedDestination()).toBe('billing_web')
  })

  it('projects a settled purchase into the response the dialog handles and refreshes capabilities', async () => {
    vi.mocked(harness.sdk.topup.createTopupCheckout).mockResolvedValue({
      status: 'ok',
      operation: settledTopup('succeeded'),
      creditsReconciled: true
    })

    await expect(useBillingSdkStore().createTopup(1000)).resolves.toEqual({
      billing_op_id: 'op-1',
      topup_id: '',
      status: 'completed',
      amount_cents: 1000
    })
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
  })

  it('reports a decline without touching capabilities', async () => {
    vi.mocked(harness.sdk.topup.createTopupCheckout).mockResolvedValue({
      status: 'declined',
      operation: failedTopup()
    })

    await expect(useBillingSdkStore().createTopup(1000)).resolves.toMatchObject(
      { status: 'failed' }
    )
    expect(useBillingCapabilities().refresh).not.toHaveBeenCalled()
  })

  it('rejects a refused purchase with the error code the dialog reads', async () => {
    vi.mocked(harness.sdk.topup.createTopupCheckout).mockResolvedValue({
      status: 'error',
      code: 'NO_PAYMENT_METHOD',
      recoveryAction: 'replace_payment_method'
    })

    await expect(useBillingSdkStore().createTopup(1000)).rejects.toSatisfy(
      (error) =>
        error instanceof WorkspaceApiError && error.code === 'NO_PAYMENT_METHOD'
    )
  })

  it('surfaces the top-up waiting on the customer and hides it once dismissed', () => {
    const store = useBillingSdkStore()

    harness.publish(pendingTopup())
    expect(store.isAddingCredits).toBe(true)
    expect(store.topupActionOperation).toBeUndefined()

    harness.publish(pendingTopup({ actionUrl: 'https://verify.example/op-1' }))
    expect(store.topupActionOperation).toMatchObject({
      opId: 'op-1',
      actionUrl: 'https://verify.example/op-1'
    })

    store.dismissOperation('op-1')
    expect(store.topupActionOperation).toBeUndefined()
    expect(store.isAddingCredits).toBe(false)
  })

  it('keeps the progress toast in step with the verification the server asks for', () => {
    useBillingSdkStore()
    const toasts = useToastStore()

    harness.publish(pendingTopup())
    expect(toasts.messagesToAdd).toEqual([
      expect.objectContaining({
        severity: 'info',
        summary: 'Processing payment — adding credits...'
      })
    ])

    harness.publish(pendingTopup({ actionUrl: 'https://verify.example/op-1' }))
    expect(toasts.messagesToRemove).toEqual([
      expect.objectContaining({ severity: 'info' })
    ])
    expect(toasts.messagesToAdd.at(-1)).toMatchObject({
      severity: 'warn',
      summary: 'Verify your payment to add your credits'
    })

    harness.publish(settledTopup('succeeded'))
    expect(toasts.messagesToRemove.at(-1)).toMatchObject({ severity: 'warn' })
  })

  it('drives a required in-page challenge once per operation', () => {
    useBillingSdkStore()
    const challenged = pendingTopup({
      presentation: 'embedded',
      challenge: { clientSecret: 'pi_secret', status: 'required' }
    })

    harness.publish(challenged)
    harness.publish(challenged)

    expect(harness.sdk.driveChallenge).toHaveBeenCalledExactlyOnceWith('op-1')
  })

  it('refuses to retry a challenge while embedded checkout is off', async () => {
    await expect(
      useBillingSdkStore().retryPaymentAuthentication('op-1')
    ).resolves.toBe(false)
    expect(harness.sdk.driveChallenge).not.toHaveBeenCalled()
  })

  it('retries the in-page challenge on request and reports whether it completed', async () => {
    flagState.embeddedCheckoutEnabled = true
    const store = useBillingSdkStore()
    vi.mocked(harness.sdk.driveChallenge).mockResolvedValueOnce('failed')

    await expect(store.retryPaymentAuthentication('op-1')).resolves.toBe(false)
    await expect(store.retryPaymentAuthentication('op-1')).resolves.toBe(true)
    expect(harness.sdk.driveChallenge).toHaveBeenCalledTimes(2)

    harness.publish(
      pendingTopup({
        presentation: 'embedded',
        challenge: { clientSecret: 'pi_secret', status: 'required' }
      })
    )
    expect(harness.sdk.driveChallenge).toHaveBeenCalledTimes(2)
  })

  it('finishes a reattached top-up the way the poller did', async () => {
    useBillingSdkStore()

    options.onTelemetry(startedEvent(true))
    options.onTelemetry({
      ...startedEvent(true),
      name: 'billing.operation.succeeded',
      duration_ms: 1200
    })
    harness.publish(settledTopup('succeeded'))

    await vi.waitFor(() =>
      expect(mockShowSettings).toHaveBeenCalledWith('workspace')
    )
    expect(mockFetchStatus).toHaveBeenCalledOnce()
    expect(mockFetchBalance).toHaveBeenCalledOnce()
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'top-up-credits'
    })
    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'success',
        summary: 'Credits added successfully'
      })
    )
    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'operation',
      operation_type: 'topup',
      stage: 'started',
      outcome: 'pending'
    })
    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'operation',
      operation_type: 'topup',
      billing_op_id: 'op-1',
      duration_ms: 1200,
      stage: 'succeeded',
      outcome: 'success'
    })
  })

  it('leaves a top-up it issued to the dialog that issued it', async () => {
    useBillingSdkStore()

    options.onTelemetry(startedEvent(false))
    options.onTelemetry({
      ...startedEvent(false),
      name: 'billing.operation.succeeded',
      duration_ms: 1200
    })
    harness.publish(settledTopup('succeeded'))
    await nextTick()

    expect(mockTrackBillingEvent).not.toHaveBeenCalled()
    expect(mockShowSettings).not.toHaveBeenCalled()
    expect(mockFetchStatus).not.toHaveBeenCalled()
    expect(useToastStore().messagesToAdd).toEqual([])
  })

  it('reports the decline of a reattached top-up with its coded reason', () => {
    useBillingSdkStore()

    options.onTelemetry(startedEvent(true))
    harness.publish(failedTopup('expired_card'))

    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        summary: 'Top-up failed',
        detail: 'This card has expired. Use a different payment method.'
      })
    )
  })

  it('tells the customer when this tab stopped observing a top-up', () => {
    useBillingSdkStore()

    harness.publish(settledTopup('timed_out'))

    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        summary: 'Top-up verification timed out'
      })
    )
  })

  it.for([
    { outcome: 'rejects', load: () => Promise.reject(new Error('blocked')) },
    { outcome: 'yields nothing', load: () => Promise.resolve(null) }
  ])(
    'offers no challenge port when the payment provider script $outcome',
    async ({ load }) => {
      vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_challenge')
      mockLoadStripe.mockImplementation(load)
      useBillingSdkStore()

      await expect(options.challengePort()).resolves.toBeUndefined()
    }
  )

  it('polls every pending operation when the tab returns', () => {
    useBillingSdkStore()

    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))

    expect(harness.sdk.lifecycle.wake).toHaveBeenCalledTimes(2)
  })

  it('reports a cancel it issued, which no dialog reports on this rail', () => {
    useBillingSdkStore()

    options.onTelemetry({
      name: 'billing.operation.succeeded',
      billing_op_id: 'op-cancel',
      operation_type: 'cancel',
      presentation: 'hosted',
      resumed: false,
      duration_ms: 900
    })

    expect(mockTrackBillingEvent).toHaveBeenCalledWith({
      operation: 'operation',
      operation_type: 'cancel',
      billing_op_id: 'op-cancel',
      duration_ms: 900,
      stage: 'succeeded',
      outcome: 'success'
    })
  })
})

describe('useBillingSdkStore subscription commands', () => {
  const SETTLED = {
    status: 'ok',
    value: { phase: 'succeeded', operation: settledOperation('succeeded') }
  } as const

  // A subscribe the server activated on the spot, so the projection's
  // `requiredPayment` reads off a status the fixture states rather than off a
  // field it happens to omit.
  const SETTLED_SUBSCRIBE = {
    status: 'ok',
    value: {
      phase: 'succeeded',
      operation: settledOperation('succeeded', 'subscription'),
      issuedStatus: 'subscribed'
    }
  } as const

  const ROUTE_MISSING = {
    status: 'error',
    code: 'NOT_FOUND',
    httpStatus: 404
  } as const

  const QUOTE = {
    allowed: true,
    cost_next_period_cents: 2000,
    cost_today_cents: 1500,
    credits_next_period_cents: 2000,
    credits_today_cents: 1500,
    effective_at: '2026-10-01T00:00:00.000Z',
    is_immediate: true,
    new_plan: {
      credits_cents: 2000,
      duration: 'MONTHLY',
      price_cents: 2000,
      seat_summary: {
        seat_count: 1,
        total_cost_cents: 2000,
        total_credits_cents: 2000
      },
      slug: 'pro-monthly',
      tier: 'PRO'
    },
    transition_type: 'upgrade'
  } as const

  it('refreshes what the poller refreshed after a cancel settles', async () => {
    vi.mocked(harness.sdk.commands.cancelSubscription).mockResolvedValue(
      SETTLED
    )

    await expect(useBillingSdkStore().cancelSubscription()).resolves.toEqual({
      status: 'ok',
      value: undefined
    })
    expect(mockFetchStatus).toHaveBeenCalledOnce()
    expect(mockFetchBalance).toHaveBeenCalledOnce()
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
  })

  it('reconciles the subscription after a resubscribe settles', async () => {
    vi.mocked(harness.sdk.commands.resubscribe).mockResolvedValue(SETTLED)

    await expect(useBillingSdkStore().resubscribe()).resolves.toEqual({
      status: 'ok',
      value: undefined
    })
    expect(mockReconcileSubscription).toHaveBeenCalledOnce()
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
  })

  it('stops sending to a route the backend answered 404, for every action', async () => {
    vi.mocked(harness.sdk.commands.cancelSubscription).mockResolvedValue(
      ROUTE_MISSING
    )
    const store = useBillingSdkStore()

    await store.cancelSubscription()
    await store.cancelSubscription()
    await expect(store.resubscribe()).resolves.toEqual({
      status: 'unavailable'
    })
    await expect(
      store.openPaymentPortal('https://app.example/')
    ).resolves.toEqual({ status: 'unavailable' })
    await expect(store.subscribe({ plan_slug: 'pro-yearly' })).resolves.toEqual(
      { status: 'unavailable' }
    )
    await expect(
      store.previewSubscribe({ planSlug: 'pro-yearly' })
    ).resolves.toEqual({ status: 'unavailable' })

    expect(harness.sdk.commands.cancelSubscription).toHaveBeenCalledOnce()
    expect(harness.sdk.commands.resubscribe).not.toHaveBeenCalled()
    expect(harness.sdk.commands.openPaymentPortal).not.toHaveBeenCalled()
    expect(harness.sdk.commands.subscribe).not.toHaveBeenCalled()
    expect(harness.sdk.commands.previewSubscribe).not.toHaveBeenCalled()
    expect(mockFetchStatus).not.toHaveBeenCalled()
  })

  it('reconciles the subscription after a plan change settles', async () => {
    vi.mocked(harness.sdk.commands.subscribe).mockResolvedValue(
      SETTLED_SUBSCRIBE
    )

    await expect(
      useBillingSdkStore().subscribe({ plan_slug: 'pro-yearly' })
    ).resolves.toEqual({
      status: 'ok',
      value: {
        billing_op_id: 'op-1',
        status: 'subscribed',
        requiredPayment: false
      }
    })
    expect(harness.sdk.commands.subscribe).toHaveBeenCalledWith({
      plan_slug: 'pro-yearly'
    })
    expect(mockReconcileSubscription).toHaveBeenCalledOnce()
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
  })

  function reattachedSubscribe() {
    options.onTelemetry({
      name: 'billing.operation.started',
      billing_op_id: 'op-1',
      operation_type: 'subscription',
      presentation: 'hosted',
      resumed: true
    })
  }

  it('finishes a reattached subscribe the way the poller did', async () => {
    useBillingSdkStore()

    reattachedSubscribe()
    harness.publish(settledOperation('succeeded', 'subscription'))

    await vi.waitFor(() =>
      expect(useToastStore().messagesToAdd).toContainEqual(
        expect.objectContaining({
          severity: 'success',
          summary: 'Subscription updated successfully'
        })
      )
    )
    expect(mockReconcileSubscription).toHaveBeenCalledOnce()
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
  })

  it('reports the failure of a reattached subscribe', () => {
    useBillingSdkStore()

    reattachedSubscribe()
    harness.publish(failedOperation('subscription'))

    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        summary: 'Subscription update failed'
      })
    )
  })

  it('reports a reattached subscribe that timed out, without reconciling', () => {
    useBillingSdkStore()

    reattachedSubscribe()
    harness.publish(settledOperation('timed_out', 'subscription'))

    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        summary: 'Subscription verification timed out'
      })
    )
    expect(mockReconcileSubscription).not.toHaveBeenCalled()
  })

  it('leaves a subscribe it issued to the checkout that issued it', async () => {
    useBillingSdkStore()

    harness.publish(settledOperation('succeeded', 'subscription'))
    await nextTick()

    expect(mockReconcileSubscription).not.toHaveBeenCalled()
    expect(useToastStore().messagesToAdd).toEqual([])
  })

  it('hands back the quote without refreshing anything', async () => {
    vi.mocked(harness.sdk.commands.previewSubscribe).mockResolvedValue({
      status: 'ok',
      value: QUOTE
    })

    await expect(
      useBillingSdkStore().previewSubscribe({ planSlug: 'pro-yearly' })
    ).resolves.toEqual({ status: 'ok', value: QUOTE })
    expect(mockReconcileSubscription).not.toHaveBeenCalled()
    expect(mockFetchStatus).not.toHaveBeenCalled()
  })

  it('warns once and keeps a blocked payment page reachable however long it polls', () => {
    const openPage = vi.spyOn(window, 'open').mockReturnValue(null)
    const store = useBillingSdkStore()
    const toasts = useToastStore()

    harness.publish(
      pendingSubscription({ actionUrl: 'https://pay.example/op-1' })
    )
    harness.publish(
      pendingSubscription({
        actionUrl: 'https://pay.example/op-1',
        customerActionSeen: true
      })
    )
    harness.publish(
      pendingSubscription({
        actionUrl: 'https://pay.example/op-1',
        customerActionSeen: true,
        authenticationState: 'requires_action'
      })
    )

    expect(openPage).toHaveBeenCalledExactlyOnceWith(
      'https://pay.example/op-1',
      '_blank'
    )
    expect(toasts.messagesToAdd).toEqual([
      expect.objectContaining({ severity: 'warn' })
    ])
    expect(store.subscriptionActionUrl).toBe('https://pay.example/op-1')
  })

  it('offers the next hosted page the same subscribe moves to', () => {
    const openPage = vi.spyOn(window, 'open').mockReturnValue(null)
    const store = useBillingSdkStore()

    harness.publish(
      pendingSubscription({ actionUrl: 'https://pay.example/first' })
    )
    harness.publish(
      pendingSubscription({ actionUrl: 'https://pay.example/second' })
    )

    expect(openPage).toHaveBeenCalledTimes(2)
    expect(store.subscriptionActionUrl).toBe('https://pay.example/second')
  })

  it('does not re-offer a hosted page this operation already offered', () => {
    const openPage = vi.spyOn(window, 'open').mockReturnValue(null)
    useBillingSdkStore()

    harness.publish(
      pendingSubscription({ actionUrl: 'https://pay.example/first' })
    )
    harness.publish(
      pendingSubscription({ actionUrl: 'https://pay.example/second' })
    )
    harness.publish(
      pendingSubscription({ actionUrl: 'https://pay.example/first' })
    )

    expect(openPage).toHaveBeenCalledTimes(2)
  })

  it('offers nothing for a hosted page that is not https', () => {
    const openPage = vi.spyOn(window, 'open').mockReturnValue(null)
    const store = useBillingSdkStore()

    harness.publish(
      pendingSubscription({ actionUrl: 'javascript:alert(document.cookie)' })
    )

    expect(openPage).not.toHaveBeenCalled()
    expect(store.subscriptionActionUrl).toBeNull()
  })

  it('offers nothing once the subscribe has settled', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const store = useBillingSdkStore()

    harness.publish(
      pendingSubscription({ actionUrl: 'https://pay.example/op-1' })
    )
    harness.publish(settledOperation('succeeded', 'subscription'))

    expect(store.subscriptionActionUrl).toBeNull()
  })

  it('drives the in-page challenge a subscribe raises, as it does for a top-up', async () => {
    useBillingSdkStore()

    harness.publish(
      pendingSubscription({
        presentation: 'embedded',
        challenge: { clientSecret: 'cs_1', status: 'required' }
      })
    )
    await nextTick()

    expect(harness.sdk.driveChallenge).toHaveBeenCalledExactlyOnceWith('op-1')
  })

  it('hands back the portal URL without refreshing anything', async () => {
    vi.mocked(harness.sdk.commands.openPaymentPortal).mockResolvedValue({
      status: 'ok',
      value: { url: 'https://portal.example/session' }
    })

    await expect(
      useBillingSdkStore().openPaymentPortal('https://app.example/')
    ).resolves.toEqual({
      status: 'ok',
      value: 'https://portal.example/session'
    })
    expect(harness.sdk.commands.openPaymentPortal).toHaveBeenCalledWith({
      returnUrl: 'https://app.example/'
    })
    expect(mockFetchStatus).not.toHaveBeenCalled()
  })

  it('drops the saved cards it holds when it hands the portal URL out', async () => {
    vi.mocked(harness.sdk.commands.openPaymentPortal).mockResolvedValue({
      status: 'ok',
      value: { url: 'https://portal.example/session' }
    })

    await useBillingSdkStore().openPaymentPortal('https://app.example/')

    expect(harness.sdk.paymentMethods.invalidate).toHaveBeenCalledOnce()
  })

  it('keeps the saved cards it holds when the portal never opened', async () => {
    vi.mocked(harness.sdk.commands.openPaymentPortal).mockResolvedValue(
      ROUTE_MISSING
    )

    await useBillingSdkStore().openPaymentPortal('https://app.example/')

    expect(harness.sdk.paymentMethods.invalidate).not.toHaveBeenCalled()
  })
})

describe('useBillingSdkStore operation projections', () => {
  const otherWorkspace = {
    userId: 'uid-1',
    workspaceId: 'ws-2',
    role: 'owner'
  } as const

  beforeEach(() => {
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-1' })
  })

  describe('recoverPendingOperation', () => {
    it('resolves with the operation once the lifecycle settles it', async () => {
      const store = useBillingSdkStore()
      vi.mocked(harness.sdk.lifecycle.recover).mockImplementation(async () => {
        harness.publish(pendingSubscription())
        return { status: 'ok', value: pendingSubscription() }
      })

      const settling = store.recoverPendingOperation('op-1')
      harness.publish(settledTopup('succeeded'))

      await expect(settling).resolves.toMatchObject({
        opId: 'op-1',
        status: 'succeeded'
      })
    })

    it('adopts nothing when the server names a different operation', async () => {
      const store = useBillingSdkStore()

      await expect(
        store.recoverPendingOperation('op-elsewhere')
      ).resolves.toBeUndefined()
    })

    it('adopts nothing when the recovery read fails', async () => {
      const store = useBillingSdkStore()
      vi.mocked(harness.sdk.lifecycle.recover).mockResolvedValue({
        status: 'error',
        code: 'REQUEST_FAILED'
      })

      await expect(
        store.recoverPendingOperation('op-1')
      ).resolves.toBeUndefined()
    })
  })

  it('reports a pending operation, and stops once it settles', () => {
    const store = useBillingSdkStore()
    expect(store.hasPendingOperations).toBe(false)

    harness.publish(pendingTopup())
    expect(store.hasPendingOperations).toBe(true)

    harness.publish(settledTopup('succeeded'))
    expect(store.hasPendingOperations).toBe(false)
  })

  it.for([
    ['a pending subscribe is setting up', pendingSubscription(), true],
    [
      'one parked on a bank challenge is waiting on the customer, not setting up',
      pendingSubscription({ authenticationState: 'requires_action' }),
      false
    ],
    [
      'one the customer must retry is not setting up either',
      pendingSubscription({ authenticationState: 'failed_retryable' }),
      false
    ],
    ['a top-up is not a subscription setup', pendingTopup(), false],
    [
      'another workspace’s subscribe does not set this one up',
      pendingSubscription({ scope: otherWorkspace }),
      false
    ]
  ] as const)('%s', ([, state, expected]) => {
    const store = useBillingSdkStore()

    harness.publish(state)

    expect(store.isSettingUp).toBe(expected)
  })

  it('offers the subscription that is waiting on the customer here', () => {
    const store = useBillingSdkStore()

    harness.publish(
      pendingSubscription({ id: 'op-elsewhere', scope: otherWorkspace })
    )
    harness.publish(
      pendingSubscription({
        id: 'op-here',
        authenticationState: 'requires_action'
      })
    )

    expect(store.subscriptionActionOperation?.opId).toBe('op-here')
  })

  it('has no action operation while the subscribe just runs', () => {
    const store = useBillingSdkStore()

    harness.publish(pendingSubscription())

    expect(store.subscriptionActionOperation).toBeUndefined()
  })

  it('looks an operation up by id, in the record shape', () => {
    const store = useBillingSdkStore()

    harness.publish(
      pendingSubscription({
        id: 'op-7',
        serverPhase: 'awaiting_payment_method'
      })
    )

    expect(store.getOperation('op-7')).toMatchObject({
      opId: 'op-7',
      kind: 'subscription',
      workspaceId: 'ws-1',
      status: 'pending',
      phase: 'awaiting_payment_method'
    })
  })

  it('finds an operation in another workspace, leaving the scope check to the caller', () => {
    const store = useBillingSdkStore()

    harness.publish(pendingSubscription({ id: 'op-9', scope: otherWorkspace }))

    expect(store.getOperation('op-9')?.workspaceId).toBe('ws-2')
  })

  it.for([
    ['an id it never saw', 'op-missing'],
    ['an operation whose scope moved on', 'op-1']
  ] as const)('has no record for %s', ([, opId]) => {
    const store = useBillingSdkStore()

    harness.publish(settledTopup('superseded'))

    expect(store.getOperation(opId)).toBeUndefined()
  })
})

describe('useBillingSdkStore billing events', () => {
  const EVENT = {
    createdAt: '2026-09-01T12:00:00.000Z',
    event_id: 'evt-1',
    event_type: 'topup_completed'
  }

  const SNAPSHOT = {
    status: 'ok',
    value: {
      events: [EVENT],
      page: 2,
      limit: 20,
      total: 21,
      totalPages: 2,
      scope: { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' },
      readAt: 1_700_000_000_000
    }
  } as const

  it('asks for the page it was given and returns it without the read metadata', async () => {
    vi.mocked(harness.sdk.events.read).mockResolvedValue(SNAPSHOT)

    const result = await useBillingSdkStore().readEvents({
      page: 2,
      limit: 20
    })

    expect(harness.sdk.events.read).toHaveBeenCalledWith({
      page: 2,
      limit: 20
    })
    expect(result).toEqual({
      status: 'ok',
      value: { events: [EVENT], page: 2, limit: 20, total: 21, totalPages: 2 }
    })
  })

  it('passes a failed read through untouched', async () => {
    const failure = { status: 'error', code: 'ACCESS_DENIED' } as const
    vi.mocked(harness.sdk.events.read).mockResolvedValue(failure)

    expect(await useBillingSdkStore().readEvents()).toEqual(failure)
  })
})
