import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useToastStore } from '@/platform/updates/common/toastStore'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { workspaceApiUrl } from '@/platform/workspace/api/workspaceApiUrl'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { useDialogStore } from '@/stores/dialogStore'

import { useBillingSdkStore } from './billingSdkStore'
import {
  fakeBillingSdk,
  failedTopup,
  pendingTopup,
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

const mockCapabilitiesRefresh = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock<unknown>(
  import('@/platform/workspace/composables/useBillingCapabilities'),
  () => ({
    useBillingCapabilities: () => ({ refresh: mockCapabilitiesRefresh })
  })
)

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

const mockLoadStripe = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@stripe/stripe-js/pure'), () => ({
  loadStripe: mockLoadStripe
}))

let harness: ReturnType<typeof fakeBillingSdk>
let options: BillingSdkOptions

beforeEach(() => {
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
    expect(mockCapabilitiesRefresh).toHaveBeenCalledOnce()
  })

  it('reports a decline without touching capabilities', async () => {
    vi.mocked(harness.sdk.topup.createTopupCheckout).mockResolvedValue({
      status: 'declined',
      operation: failedTopup()
    })

    await expect(useBillingSdkStore().createTopup(1000)).resolves.toMatchObject(
      { status: 'failed' }
    )
    expect(mockCapabilitiesRefresh).not.toHaveBeenCalled()
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
    expect(mockCapabilitiesRefresh).toHaveBeenCalledOnce()
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

  const ROUTE_MISSING = {
    status: 'error',
    code: 'NOT_FOUND',
    httpStatus: 404
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
    expect(mockCapabilitiesRefresh).toHaveBeenCalledOnce()
  })

  it('reconciles the subscription after a resubscribe settles', async () => {
    vi.mocked(harness.sdk.commands.resubscribe).mockResolvedValue(SETTLED)

    await expect(useBillingSdkStore().resubscribe()).resolves.toEqual({
      status: 'ok',
      value: undefined
    })
    expect(mockReconcileSubscription).toHaveBeenCalledOnce()
    expect(mockCapabilitiesRefresh).toHaveBeenCalledOnce()
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

    expect(harness.sdk.commands.cancelSubscription).toHaveBeenCalledOnce()
    expect(harness.sdk.commands.resubscribe).not.toHaveBeenCalled()
    expect(harness.sdk.commands.openPaymentPortal).not.toHaveBeenCalled()
    expect(mockFetchStatus).not.toHaveBeenCalled()
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
