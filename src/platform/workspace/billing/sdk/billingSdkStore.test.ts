import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useTelemetry } from '@/platform/telemetry'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { workspaceApiUrl } from '@/platform/workspace/api/workspaceApiUrl'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import {
  bindOperationToCheckoutJourney,
  clearCheckoutJourney,
  resolveCheckoutJourney
} from '@/platform/workspace/utils/checkoutJourney'
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
import type {
  BillingOperationKind,
  BillingOperationTelemetryEvent,
  HostedBillingDestination
} from '@comfyorg/account-core/billing'
import { BILLING_OPERATION_TELEMETRY_EVENT } from '@comfyorg/account-core/billing'
import type { BillingSdk, BillingSdkOptions } from './createBillingSdk'

const mockCreateBillingSdk = vi.hoisted(() =>
  vi.fn<(options: BillingSdkOptions) => BillingSdk>()
)
vi.mock(import('./createBillingSdk'), () => ({
  createBillingSdk: mockCreateBillingSdk
}))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/composables/useFeatureFlags'))

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
  vi.mocked(useFeatureFlags().flags).embeddedCheckoutEnabled = false
  vi.mocked(useFeatureFlags().flags).hostedBillingDestination = 'stripe'
  vi.mocked(useBillingContext).mockReturnValue(useBillingContext())
  remoteConfig.value = {}
  harness = fakeBillingSdk()
  mockCreateBillingSdk.mockImplementation((sdkOptions) => {
    options = sdkOptions
    return harness.sdk
  })
  vi.mocked(useDialogStore().closeDialog).mockImplementation(() => {})
})

afterEach(() => {
  clearCheckoutJourney()
  sessionStorage.clear()
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
      vi.mocked(useFeatureFlags().flags).hostedBillingDestination = destination
      useBillingSdkStore()

      expect(options.hostedDestination()).toBe(destination)
    }
  )

  it('re-reads the destination flag rather than capturing it at composition', () => {
    useBillingSdkStore()

    vi.mocked(useFeatureFlags().flags).hostedBillingDestination = 'billing_web'

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
    const toast = useToast()

    harness.publish(pendingTopup())
    expect(toast.toasts).toEqual([
      expect.objectContaining({
        kind: 'loading',
        title: 'Processing payment — adding credits...',
        duration: Number.POSITIVE_INFINITY
      })
    ])

    harness.publish(pendingTopup({ actionUrl: 'https://verify.example/op-1' }))
    expect(toast.toasts).toEqual([
      expect.objectContaining({
        kind: 'warning',
        title: 'Verify your payment to add your credits',
        duration: Number.POSITIVE_INFINITY
      })
    ])

    harness.publish(settledTopup('succeeded'))
    expect(toast.toasts).toEqual([])
  })

  it('keeps a subscribe in step with its progress toast, as the poller did', () => {
    useBillingSdkStore()
    const toast = useToast()

    harness.publish(pendingSubscription())
    expect(toast.toasts).toEqual([
      expect.objectContaining({
        kind: 'loading',
        title: 'Processing payment — setting up your workspace...'
      })
    ])

    harness.publish(
      pendingSubscription({ actionUrl: 'https://verify.example/op-1' })
    )
    expect(toast.toasts.at(-1)).toMatchObject({
      kind: 'warning',
      title: 'Verify your payment to finish setting up your workspace'
    })

    harness.publish(settledOperation('succeeded', 'subscription'))
    expect(toast.toasts).toEqual([])
  })

  it.for([
    {
      kind: 'subscription',
      actionRequired: 'Verify your payment to finish setting up your workspace'
    },
    { kind: 'topup', actionRequired: 'Verify your payment to add your credits' }
  ] as const)(
    'raises no progress toast for a $kind parked on a payment method until the server serves a link',
    ({ kind, actionRequired }) => {
      useBillingSdkStore()
      const toast = useToast()
      const parked = { kind, serverPhase: 'awaiting_payment_method' } as const

      harness.publish(pendingTopup(parked))
      expect(toast.toasts).toEqual([])

      harness.publish(
        pendingTopup({ ...parked, actionUrl: 'https://verify.example/op-1' })
      )
      expect(toast.toasts).toEqual([
        expect.objectContaining({ kind: 'warning', title: actionRequired })
      ])
    }
  )

  it('shows no progress toast for a cancel', () => {
    useBillingSdkStore()

    harness.publish(pendingTopup({ kind: 'cancel' }))

    expect(useToast().toasts).toEqual([])
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
    vi.mocked(useFeatureFlags().flags).embeddedCheckoutEnabled = true
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

  it('reports the source of the journey a reattached operation is bound to', () => {
    resolveCheckoutJourney({
      actorUid: 'user-1',
      workspaceId: 'ws-1',
      entryFlow: 'topup',
      entrySource: 'settings_billing',
      paymentIntentSource: 'avatar_menu_plans',
      assignment: { status: 'unavailable' }
    })
    bindOperationToCheckoutJourney('op-1')
    useBillingSdkStore()

    options.onTelemetry({
      ...startedEvent(true),
      name: 'billing.operation.succeeded',
      duration_ms: 1200
    })

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'operation',
        stage: 'succeeded',
        billing_op_id: 'op-1',
        payment_intent_source: 'avatar_menu_plans'
      })
    )
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
      expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
    )
    expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
    expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'top-up-credits'
    })
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'success',
        title: 'Credits added successfully',
        duration: 5000
      })
    )
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'operation',
      billing_client: 'sdk',
      operation_type: 'topup',
      billing_op_id: 'op-1',
      presentation: 'hosted',
      resumed: true,
      stage: 'started',
      outcome: 'pending'
    })
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'operation',
      billing_client: 'sdk',
      operation_type: 'topup',
      billing_op_id: 'op-1',
      presentation: 'hosted',
      resumed: true,
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

    expect(useTelemetry()?.trackBillingEvent).not.toHaveBeenCalled()
    expect(useSettingsDialog().show).not.toHaveBeenCalled()
    expect(useBillingContext().fetchStatus).not.toHaveBeenCalled()
    expect(useToast().toasts).toEqual([])
  })

  it('reports the decline of a reattached top-up with its coded reason', () => {
    useBillingSdkStore()

    options.onTelemetry(startedEvent(true))
    harness.publish(failedTopup('expired_card'))

    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'error',
        title: 'Top-up failed',
        description: 'This card has expired. Use a different payment method.',
        duration: 7000
      })
    )
  })

  it('tells the customer when this tab stopped observing a top-up', () => {
    useBillingSdkStore()

    harness.publish(settledTopup('timed_out'))

    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'error',
        title: 'Top-up verification timed out',
        duration: Number.POSITIVE_INFINITY
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

  it('prefers the server-configured publishable key over the build-time one', async () => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_build_time')
    remoteConfig.value = { stripe_publishable_key: 'pk_server' }
    mockLoadStripe.mockResolvedValue({})
    useBillingSdkStore()

    await options.challengePort()

    expect(mockLoadStripe).toHaveBeenCalledWith('pk_server')
  })

  it('falls back to the build-time key when the server has none configured', async () => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_build_time')
    remoteConfig.value = {}
    mockLoadStripe.mockResolvedValue({})
    useBillingSdkStore()

    await options.challengePort()

    expect(mockLoadStripe).toHaveBeenCalledWith('pk_build_time')
  })

  it.for(['', 42] as const)(
    'treats a malformed server key (%j) as absent',
    async (malformed) => {
      vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_build_time')
      remoteConfig.value = {
        stripe_publishable_key: malformed as unknown as string
      }
      mockLoadStripe.mockResolvedValue({})
      useBillingSdkStore()

      await options.challengePort()

      expect(mockLoadStripe).toHaveBeenCalledWith('pk_build_time')
    }
  )

  it('reports checkout unavailable when neither source configures a key', () => {
    vi.mocked(useFeatureFlags().flags).embeddedCheckoutEnabled = true
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', undefined)
    remoteConfig.value = {}
    useBillingSdkStore()

    expect(options.embeddedCheckoutAvailable()).toBe(false)
  })

  it('reports checkout available on the server key alone, with no build-time key', () => {
    vi.mocked(useFeatureFlags().flags).embeddedCheckoutEnabled = true
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', undefined)
    remoteConfig.value = { stripe_publishable_key: 'pk_server' }
    useBillingSdkStore()

    expect(options.embeddedCheckoutAvailable()).toBe(true)
  })

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

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'operation',
      billing_client: 'sdk',
      operation_type: 'cancel',
      billing_op_id: 'op-cancel',
      presentation: 'hosted',
      resumed: false,
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
      value: { operationObserved: true }
    })
    expect(useBillingContext().fetchStatus).toHaveBeenCalledOnce()
    expect(useBillingContext().fetchBalance).toHaveBeenCalledOnce()
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
  })

  it('reconciles the subscription after a resubscribe settles', async () => {
    vi.mocked(harness.sdk.commands.resubscribe).mockResolvedValue(SETTLED)

    await expect(useBillingSdkStore().resubscribe()).resolves.toEqual({
      status: 'ok',
      value: { operationObserved: true }
    })
    expect(
      useBillingContext().reconcileSubscriptionSuccess
    ).toHaveBeenCalledOnce()
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
    expect(useBillingContext().fetchStatus).not.toHaveBeenCalled()
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
        requiredPayment: false,
        operationObserved: true
      }
    })
    expect(harness.sdk.commands.subscribe).toHaveBeenCalledWith({
      plan_slug: 'pro-yearly'
    })
    expect(
      useBillingContext().reconcileSubscriptionSuccess
    ).toHaveBeenCalledOnce()
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

  it('opens no payment page for a subscribe it reattached to, leaving it to the customer', () => {
    const openPage = vi.spyOn(window, 'open').mockReturnValue(null)
    const store = useBillingSdkStore()

    reattachedSubscribe()
    harness.publish(
      pendingSubscription({ actionUrl: 'https://pay.example/op-1' })
    )

    expect(openPage).not.toHaveBeenCalled()
    expect(useToast().toasts).toHaveLength(1)
    expect(store.subscriptionActionUrl).toBe('https://pay.example/op-1')
  })

  it('drives no in-page challenge for a subscribe it reattached to', async () => {
    const openPage = vi.spyOn(window, 'open').mockReturnValue(null)
    const store = useBillingSdkStore()

    reattachedSubscribe()
    harness.publish(
      pendingSubscription({
        presentation: 'embedded',
        actionUrl: 'https://pay.example/invoice',
        challenge: { clientSecret: 'pi_secret', status: 'required' }
      })
    )
    await nextTick()

    expect(harness.sdk.driveChallenge).not.toHaveBeenCalled()
    expect(openPage).not.toHaveBeenCalled()
    expect(store.subscriptionActionUrl).toBe('https://pay.example/invoice')
  })

  it('finishes a reattached subscribe the way the poller did', async () => {
    useBillingSdkStore()

    reattachedSubscribe()
    harness.publish(settledOperation('succeeded', 'subscription'))

    await vi.waitFor(() =>
      expect(useToast().success).toHaveBeenCalledWith(
        'Subscription updated successfully',
        { duration: 5000 }
      )
    )
    expect(
      useBillingContext().reconcileSubscriptionSuccess
    ).toHaveBeenCalledOnce()
    expect(useBillingCapabilities().refresh).toHaveBeenCalledOnce()
  })

  it('reports the failure of a reattached subscribe', () => {
    useBillingSdkStore()

    reattachedSubscribe()
    harness.publish(failedOperation('subscription'))

    expect(useToast().error).toHaveBeenCalledWith(
      'Subscription update failed',
      expect.objectContaining({ duration: 7000 })
    )
  })

  it('reports a reattached subscribe that timed out, without reconciling', () => {
    useBillingSdkStore()

    reattachedSubscribe()
    harness.publish(settledOperation('timed_out', 'subscription'))

    expect(useToast().error).toHaveBeenCalledWith(
      'Subscription verification timed out'
    )
    expect(
      useBillingContext().reconcileSubscriptionSuccess
    ).not.toHaveBeenCalled()
  })

  it('leaves a subscribe it issued to the checkout that issued it', async () => {
    useBillingSdkStore()

    harness.publish(settledOperation('succeeded', 'subscription'))
    await nextTick()

    expect(
      useBillingContext().reconcileSubscriptionSuccess
    ).not.toHaveBeenCalled()
    expect(useToast().toasts).toEqual([])
  })

  it('hands back the quote without refreshing anything', async () => {
    vi.mocked(harness.sdk.commands.previewSubscribe).mockResolvedValue({
      status: 'ok',
      value: QUOTE
    })

    await expect(
      useBillingSdkStore().previewSubscribe({ planSlug: 'pro-yearly' })
    ).resolves.toEqual({ status: 'ok', value: QUOTE })
    expect(
      useBillingContext().reconcileSubscriptionSuccess
    ).not.toHaveBeenCalled()
    expect(useBillingContext().fetchStatus).not.toHaveBeenCalled()
  })

  it('warns once and keeps a blocked payment page reachable however long it polls', () => {
    const openPage = vi.spyOn(window, 'open').mockReturnValue(null)
    const store = useBillingSdkStore()

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
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'warning',
        title: 'Warning',
        description:
          "Couldn't open the payment page — please allow popups and try again."
      })
    )
    expect(store.subscriptionActionUrl).toBe('https://pay.example/op-1')
  })

  it('opens no payment page while this tab drives the in-page challenge', () => {
    const openPage = vi.spyOn(window, 'open').mockReturnValue(null)
    useBillingSdkStore()

    harness.publish(
      pendingSubscription({
        presentation: 'embedded',
        actionUrl: 'https://pay.example/invoice',
        challenge: { clientSecret: 'pi_secret', status: 'required' }
      })
    )

    expect(harness.sdk.driveChallenge).toHaveBeenCalledExactlyOnceWith('op-1')
    expect(openPage).not.toHaveBeenCalled()
    expect(useToast().toasts).toHaveLength(1)
  })

  it('opens the hosted page for an embedded operation that carries no in-page challenge', () => {
    const openPage = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    useBillingSdkStore()

    harness.publish(
      pendingSubscription({
        presentation: 'embedded',
        actionUrl: 'https://pay.example/invoice'
      })
    )

    expect(openPage).toHaveBeenCalledExactlyOnceWith(
      'https://pay.example/invoice',
      '_blank'
    )
  })

  it.for([
    { page: 'opened', opened: window, reported: [['op-1', 'new_tab']] },
    { page: 'had blocked', opened: null, reported: [] }
  ])(
    'reports to the lifecycle a hosted page it $page in a new tab',
    ({ opened, reported }) => {
      vi.spyOn(window, 'open').mockReturnValue(opened)
      useBillingSdkStore()

      harness.publish(
        pendingSubscription({ actionUrl: 'https://pay.example/first' })
      )

      expect(
        vi.mocked(harness.sdk.lifecycle.reportHostedStepOpened).mock.calls
      ).toEqual(reported)
    }
  )

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
    expect(useBillingContext().fetchStatus).not.toHaveBeenCalled()
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

describe('useBillingSdkStore telemetry ownership', () => {
  type Store = ReturnType<typeof useBillingSdkStore>

  const SETTLED = {
    status: 'ok',
    value: {
      phase: 'succeeded',
      operation: settledOperation('succeeded', 'subscription')
    }
  } as const

  const EVENTS = {
    started: { name: 'started', resumed: false },
    'resumed started': { name: 'started', resumed: true },
    terminal: { name: 'succeeded', resumed: false },
    'resumed terminal': { name: 'succeeded', resumed: true }
  } as const

  function lifecycleEvent(
    kind: BillingOperationKind,
    { name, resumed }: (typeof EVENTS)[keyof typeof EVENTS]
  ): BillingOperationTelemetryEvent {
    return {
      name: BILLING_OPERATION_TELEMETRY_EVENT[name],
      billing_op_id: 'op-1',
      operation_type: kind,
      presentation: 'hosted',
      resumed
    }
  }

  const COMMANDS = {
    'a cancel': {
      kind: 'cancel',
      stub: (fire: () => void) =>
        vi
          .mocked(harness.sdk.commands.cancelSubscription)
          .mockImplementation(async () => {
            fire()
            return SETTLED
          }),
      run: (store: Store) => store.cancelSubscription()
    },
    'a subscribe the caller announced': {
      kind: 'subscription',
      stub: (fire: () => void) =>
        vi
          .mocked(harness.sdk.commands.subscribe)
          .mockImplementation(async () => {
            fire()
            return SETTLED
          }),
      run: (store: Store) =>
        store.subscribe({ plan_slug: 'pro-yearly' }, { callerStarted: true })
    },
    'a subscribe no caller announced': {
      kind: 'subscription',
      stub: (fire: () => void) =>
        vi
          .mocked(harness.sdk.commands.subscribe)
          .mockImplementation(async () => {
            fire()
            return SETTLED
          }),
      run: (store: Store) => store.subscribe({ plan_slug: 'pro-yearly' })
    },
    'a resubscribe': {
      kind: 'subscription',
      stub: (fire: () => void) =>
        vi
          .mocked(harness.sdk.commands.resubscribe)
          .mockImplementation(async () => {
            fire()
            return SETTLED
          }),
      run: (store: Store) => store.resubscribe()
    }
  } as const

  it.for([
    { command: 'a cancel', event: 'started', reports: 0 },
    { command: 'a cancel', event: 'resumed started', reports: 1 },
    { command: 'a cancel', event: 'terminal', reports: 1 },
    { command: 'a cancel', event: 'resumed terminal', reports: 1 },
    {
      command: 'a subscribe the caller announced',
      event: 'started',
      reports: 0
    },
    {
      command: 'a subscribe the caller announced',
      event: 'resumed started',
      reports: 1
    },
    {
      command: 'a subscribe the caller announced',
      event: 'terminal',
      reports: 1
    },
    {
      command: 'a subscribe the caller announced',
      event: 'resumed terminal',
      reports: 1
    },
    {
      command: 'a subscribe no caller announced',
      event: 'started',
      reports: 1
    },
    {
      command: 'a subscribe no caller announced',
      event: 'resumed started',
      reports: 1
    },
    {
      command: 'a subscribe no caller announced',
      event: 'terminal',
      reports: 1
    },
    {
      command: 'a subscribe no caller announced',
      event: 'resumed terminal',
      reports: 1
    },
    { command: 'a resubscribe', event: 'started', reports: 1 },
    { command: 'a resubscribe', event: 'resumed started', reports: 1 },
    { command: 'a resubscribe', event: 'terminal', reports: 1 },
    { command: 'a resubscribe', event: 'resumed terminal', reports: 1 }
  ] as const)(
    'reports $reports event(s) for a lifecycle $event inside $command',
    async ({ command, event, reports }) => {
      const { kind, stub, run } = COMMANDS[command]
      const store = useBillingSdkStore()
      stub(() => options.onTelemetry(lifecycleEvent(kind, EVENTS[event])))

      await run(store)

      expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledTimes(reports)
    }
  )

  it.for(['topup', 'subscription'] as const)(
    'reports the payment friction of a %s this tab issued, which no dialog reports',
    (kind) => {
      useBillingSdkStore()

      options.onTelemetry({
        name: 'billing.checkout.challenge_failed',
        billing_op_id: 'op-1',
        operation_type: kind,
        presentation: 'embedded',
        resumed: false,
        decline_reason: 'authentication_failed'
      })

      expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
        operation: 'checkout',
        billing_client: 'sdk',
        stage: 'challenge_failed',
        outcome: 'pending',
        operation_type: kind,
        billing_op_id: 'op-1',
        presentation: 'embedded',
        resumed: false,
        decline_reason: 'authentication_failed'
      })
    }
  )

  it('reports a started that arrives once the announced command has settled', async () => {
    const store = useBillingSdkStore()
    vi.mocked(harness.sdk.commands.cancelSubscription).mockResolvedValue(
      SETTLED
    )
    await store.cancelSubscription()

    options.onTelemetry(lifecycleEvent('cancel', EVENTS.started))

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledOnce()
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

  it.for([
    {
      name: 'an adopted operation',
      result: { status: 'ok', value: pendingSubscription() },
      adopted: true
    },
    {
      name: 'nothing pending',
      result: { status: 'ok', value: undefined },
      adopted: false
    },
    {
      name: 'a failed recovery read',
      result: { status: 'error', code: 'REQUEST_FAILED' },
      adopted: false
    }
  ] as const)(
    'recover reports $name as adopted: $adopted',
    async ({ result, adopted }) => {
      vi.mocked(harness.sdk.lifecycle.recover).mockResolvedValue(result)

      await expect(useBillingSdkStore().recover()).resolves.toBe(adopted)
    }
  )

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
    [
      'a checkout parked on a payment method is not setting up',
      pendingSubscription({ serverPhase: 'awaiting_payment_method' }),
      false
    ],
    [
      'a parked checkout the server serves a link for is setting up again',
      pendingSubscription({
        serverPhase: 'awaiting_payment_method',
        actionUrl: 'https://pay.example/op-1'
      }),
      true
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
