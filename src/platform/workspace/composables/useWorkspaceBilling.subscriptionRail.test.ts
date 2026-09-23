import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

vi.mock(import('firebase/auth'), { spy: true })

import { useTelemetry } from '@/platform/telemetry'
import type {
  BillingStatusResponse,
  PreviewSubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import {
  fakeBillingSdk,
  serverCode,
  settledOperation
} from '@/platform/workspace/billing/sdk/billingSdkTestUtils'
import type { BillingSdk } from '@/platform/workspace/billing/sdk/createBillingSdk'
import { useWorkspaceBilling } from '@/platform/workspace/composables/useWorkspaceBilling'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

const flagState = vi.hoisted(() => ({
  billingSdkSubscriptionEnabled: false,
  unifiedCloudAuthEnabled: true
}))
vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({
    flags: {
      billingSdkTopupRailEnabled: false,
      embeddedCheckoutEnabled: false,
      get billingSdkSubscriptionRailEnabled() {
        return (
          flagState.billingSdkSubscriptionEnabled &&
          flagState.unifiedCloudAuthEnabled
        )
      }
    }
  })
}))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock<unknown>(
  import('@/platform/cloud/subscription/composables/useBillingPlans'),
  () => ({
    useBillingPlans: () => ({
      plans: { value: [] },
      currentPlanSlug: { value: null },
      error: { value: null },
      fetchPlans: vi.fn()
    })
  })
)

vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/platform/telemetry'))
const telemetry = useTelemetry()
if (!telemetry) throw new Error('Telemetry mock unavailable')
const mockedTelemetry = vi.mocked(telemetry)

const mockCreateBillingSdk = vi.hoisted(() => vi.fn<() => BillingSdk>())
vi.mock(import('@/platform/workspace/billing/sdk/createBillingSdk'), () => ({
  createBillingSdk: mockCreateBillingSdk
}))

const STATUS: BillingStatusResponse = {
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  has_funds: true,
  team_credit_stop: null,
  scheduled_change: null,
  subscription_status: 'canceled',
  subscription_tier: 'CREATOR',
  plan_slug: 'creator-monthly'
}

const ROUTE_MISSING = {
  status: 'error',
  code: 'NOT_FOUND',
  httpStatus: 404
} as const

const SETTLED = {
  status: 'ok',
  value: { phase: 'succeeded', operation: settledOperation('succeeded') }
} as const

// A subscribe the server activated on the spot, so `requiredPayment` below
// reads off a status the fixture states rather than off a field it omits.
const SETTLED_SUBSCRIBE = {
  status: 'ok',
  value: {
    phase: 'succeeded',
    operation: settledOperation('succeeded', 'subscription'),
    issuedStatus: 'subscribed'
  }
} as const

const PLAN_INFO = {
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
} as const

const LEGACY_QUOTE: PreviewSubscribeResponse = {
  allowed: true,
  cost_next_period_cents: 2000,
  cost_today_cents: 1500,
  credits_next_period_cents: 2000,
  credits_today_cents: 1500,
  effective_at: '2026-10-01T00:00:00.000Z',
  is_immediate: true,
  new_plan: PLAN_INFO,
  transition_type: 'upgrade'
}

const SDK_QUOTE: PreviewSubscribeResponse = {
  ...LEGACY_QUOTE,
  cost_today_cents: 900,
  transition_type: 'downgrade'
}

let harness: ReturnType<typeof fakeBillingSdk>

function setupBilling() {
  const billing = effectScope().run(() => useWorkspaceBilling())
  if (!billing) throw new Error('Failed to create billing composable')
  return billing
}

beforeEach(() => {
  stubFirebaseAuthHarness()
  harness = fakeBillingSdk()
  mockCreateBillingSdk.mockReturnValue(harness.sdk)
  flagState.billingSdkSubscriptionEnabled = false
  flagState.unifiedCloudAuthEnabled = true
  vi.spyOn(workspaceApi, 'getBillingStatus').mockResolvedValue(STATUS)
  vi.spyOn(workspaceApi, 'getBillingBalance').mockResolvedValue({
    amount_micros: 0,
    currency: 'USD'
  })
  vi.spyOn(workspaceApi, 'cancelSubscription').mockResolvedValue({
    billing_op_id: 'op-legacy',
    cancel_at: '2099-12-31T12:00:00Z'
  })
  vi.spyOn(workspaceApi, 'resubscribe').mockResolvedValue({
    billing_op_id: 'op-legacy',
    status: 'active'
  })
  vi.spyOn(workspaceApi, 'getPaymentPortalUrl').mockResolvedValue({
    url: 'https://portal.legacy.example/session'
  })
  vi.spyOn(workspaceApi, 'subscribe').mockResolvedValue({
    billing_op_id: 'op-legacy',
    status: 'subscribed'
  })
  vi.spyOn(workspaceApi, 'previewSubscribe').mockResolvedValue(LEGACY_QUOTE)
  // A tab that opens, so these routing tests are not all reading as blocked.
  vi.spyOn(window, 'open').mockReturnValue(window)
  vi.mocked(useBillingOperationStore().startOperation).mockResolvedValue({
    status: 'succeeded'
  } as never)
})

describe('cancel subscription on the billing SDK rail', () => {
  it('issues through the workspace client while the rail is off', async () => {
    await setupBilling().cancelSubscription()

    expect(workspaceApi.cancelSubscription).toHaveBeenCalledOnce()
    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('stays on the workspace client while unified auth is off', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    flagState.unifiedCloudAuthEnabled = false

    await setupBilling().cancelSubscription()

    expect(workspaceApi.cancelSubscription).toHaveBeenCalledOnce()
    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('issues through the SDK command while the rail is on', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.cancelSubscription).mockResolvedValue(
      SETTLED
    )

    await setupBilling().cancelSubscription()

    expect(harness.sdk.commands.cancelSubscription).toHaveBeenCalledOnce()
    expect(workspaceApi.cancelSubscription).not.toHaveBeenCalled()
  })

  it('falls back to the workspace client once when the route is missing', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.cancelSubscription).mockResolvedValue(
      ROUTE_MISSING
    )
    const billing = setupBilling()

    await billing.cancelSubscription()
    await billing.cancelSubscription()

    expect(harness.sdk.commands.cancelSubscription).toHaveBeenCalledOnce()
    expect(workspaceApi.cancelSubscription).toHaveBeenCalledTimes(2)
  })

  it.for([
    [
      { status: 'error', code: 'REQUEST_FAILED', httpStatus: 500 },
      "We couldn't update your subscription. Please try again."
    ],
    [
      { status: 'error', code: 'SUPERSEDED' },
      "We couldn't update your subscription. Please try again."
    ]
  ] as const)(
    'reports %o as its own detail instead of retrying on legacy',
    async ([failure, detail]) => {
      flagState.billingSdkSubscriptionEnabled = true
      vi.mocked(harness.sdk.commands.cancelSubscription).mockResolvedValue(
        failure
      )
      const billing = setupBilling()

      await expect(billing.cancelSubscription()).rejects.toBeInstanceOf(
        WorkspaceApiError
      )
      expect(billing.error.value).toBe(detail)
      expect(workspaceApi.cancelSubscription).not.toHaveBeenCalled()
    }
  )

  it('reports an operation that never settled as a failure', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.cancelSubscription).mockResolvedValue({
      status: 'ok',
      value: {
        phase: 'timed_out',
        operation: settledOperation('timed_out')
      }
    })

    await expect(setupBilling().cancelSubscription()).rejects.toThrow(
      "We couldn't update your subscription. Please try again."
    )
    expect(workspaceApi.cancelSubscription).not.toHaveBeenCalled()
  })
})

describe('cancel telemetry on the billing SDK rail', () => {
  const stages = () =>
    mockedTelemetry.trackBillingEvent.mock.calls.map(([event]) => event.stage)

  it('reports a rail cancel that settles as one started and one succeeded', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.cancelSubscription).mockResolvedValue(
      SETTLED
    )

    await setupBilling().cancelSubscription()

    expect(stages()).toEqual(['started', 'succeeded'])
  })

  it('reports a rail cancel that fails before any operation exists', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.cancelSubscription).mockResolvedValue({
      status: 'error',
      code: 'REQUEST_FAILED',
      httpStatus: 500
    })

    await expect(setupBilling().cancelSubscription()).rejects.toBeInstanceOf(
      WorkspaceApiError
    )

    expect(stages()).toEqual(['started', 'failed'])
    expect(mockedTelemetry.trackBillingEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operation_type: 'cancel',
        failure_category: 'api_rejected'
      })
    )
  })

  it('reports one started when the missing route sends the cancel to the workspace client', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.cancelSubscription).mockResolvedValue(
      ROUTE_MISSING
    )

    await setupBilling().cancelSubscription()

    expect(workspaceApi.cancelSubscription).toHaveBeenCalledOnce()
    expect(stages()).toEqual(['started'])
  })
})

describe('resubscribe on the billing SDK rail', () => {
  it('issues through the workspace client while the rail is off', async () => {
    await setupBilling().resubscribe()

    expect(workspaceApi.resubscribe).toHaveBeenCalledOnce()
    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('issues through the SDK command while the rail is on', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.resubscribe).mockResolvedValue(SETTLED)

    await setupBilling().resubscribe()

    expect(harness.sdk.commands.resubscribe).toHaveBeenCalledOnce()
    expect(workspaceApi.resubscribe).not.toHaveBeenCalled()
  })

  it('falls back to the workspace client when the route is missing', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.resubscribe).mockResolvedValue(ROUTE_MISSING)

    await setupBilling().resubscribe()

    expect(workspaceApi.resubscribe).toHaveBeenCalledOnce()
  })
})

describe('subscribe on the billing SDK rail', () => {
  it('issues through the workspace client while the rail is off', async () => {
    await setupBilling().subscribe('pro-yearly', { promotionCode: 'LAUNCH' })

    expect(workspaceApi.subscribe).toHaveBeenCalledWith('pro-yearly', {
      promotionCode: 'LAUNCH'
    })
    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('maps the host options onto the generated request body', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.subscribe).mockResolvedValue(
      SETTLED_SUBSCRIBE
    )

    const response = await setupBilling().subscribe('pro-yearly', {
      confirmationToken: '',
      savedPaymentMethodId: 'pm_123',
      promotionCode: 'LAUNCH',
      quoteId: 'quote-1',
      quoteVersion: 3,
      returnUrl: 'https://app.example/success',
      cancelUrl: 'https://app.example/failed',
      teamCreditStopId: 'stop-1',
      billingCycle: 'yearly',
      confirmReactivation: true,
      prorationAt: '2026-10-01T00:00:00.000Z'
    })

    expect(harness.sdk.commands.subscribe).toHaveBeenCalledWith({
      plan_slug: 'pro-yearly',
      confirmation_token: undefined,
      saved_payment_method_id: 'pm_123',
      promotion_code: 'LAUNCH',
      quote_id: 'quote-1',
      quote_version: 3,
      return_url: 'https://app.example/success',
      cancel_url: 'https://app.example/failed',
      team_credit_stop_id: 'stop-1',
      billing_cycle: 'yearly',
      confirm_reactivation: true,
      proration_at: '2026-10-01T00:00:00.000Z'
    })
    expect(response).toEqual({
      billing_op_id: 'op-1',
      status: 'subscribed',
      requiredPayment: false
    })
    expect(workspaceApi.subscribe).not.toHaveBeenCalled()
  })

  it('falls back to the workspace client once when the route is missing', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.subscribe).mockResolvedValue(ROUTE_MISSING)
    const billing = setupBilling()

    await billing.subscribe('pro-monthly')
    await billing.subscribe('pro-monthly')

    expect(harness.sdk.commands.subscribe).toHaveBeenCalledOnce()
    expect(workspaceApi.subscribe).toHaveBeenCalledTimes(2)
  })

  it('surfaces a reactivation block under the code the checkout branches on', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.subscribe).mockResolvedValue({
      status: 'error',
      code: 'REACTIVATION_CONFIRMATION_REQUIRED'
    })

    await expect(setupBilling().subscribe('pro-monthly')).rejects.toMatchObject(
      { code: 'REACTIVATION_CONFIRMATION_REQUIRED' }
    )
    expect(workspaceApi.subscribe).not.toHaveBeenCalled()
  })

  it('surfaces a refused transition under the server code', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.subscribe).mockResolvedValue({
      status: 'error',
      code: 'CONFLICT',
      httpStatus: 409,
      serverCode: serverCode('TRANSITION_NOT_ALLOWED')
    })

    await expect(setupBilling().subscribe('pro-monthly')).rejects.toMatchObject(
      { code: 'TRANSITION_NOT_ALLOWED', status: 409 }
    )
    expect(workspaceApi.subscribe).not.toHaveBeenCalled()
  })

  it('reports an operation that never settled as a failure', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.subscribe).mockResolvedValue({
      status: 'ok',
      value: {
        phase: 'timed_out',
        operation: settledOperation('timed_out', 'subscription')
      }
    })

    await expect(setupBilling().subscribe('pro-monthly')).rejects.toMatchObject(
      {
        message: "We couldn't update your subscription. Please try again.",
        code: 'timed_out'
      }
    )
    expect(workspaceApi.subscribe).not.toHaveBeenCalled()
  })
})

describe('preview subscribe on the billing SDK rail', () => {
  it('quotes through the workspace client while the rail is off', async () => {
    const quote = await setupBilling().previewSubscribe('pro-yearly', {
      teamCreditStopId: 'stop-1'
    })

    expect(workspaceApi.previewSubscribe).toHaveBeenCalledWith('pro-yearly', {
      teamCreditStopId: 'stop-1'
    })
    expect(quote).toEqual(LEGACY_QUOTE)
  })

  it('quotes through the SDK command while the rail is on', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.previewSubscribe).mockResolvedValue({
      status: 'ok',
      value: SDK_QUOTE
    })

    const quote = await setupBilling().previewSubscribe('pro-yearly', {
      teamCreditStopId: 'stop-1',
      promotionCode: 'LAUNCH'
    })

    expect(harness.sdk.commands.previewSubscribe).toHaveBeenCalledWith({
      planSlug: 'pro-yearly',
      teamCreditStopId: 'stop-1',
      promotionCode: 'LAUNCH'
    })
    expect(quote).toEqual(SDK_QUOTE)
    expect(workspaceApi.previewSubscribe).not.toHaveBeenCalled()
  })

  it('falls back to the workspace client when the route is missing', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.previewSubscribe).mockResolvedValue(
      ROUTE_MISSING
    )

    const quote = await setupBilling().previewSubscribe('pro-yearly')

    expect(quote).toEqual(LEGACY_QUOTE)
  })
})

describe('payment portal on the billing SDK rail', () => {
  it('opens the workspace client URL while the rail is off', async () => {
    await setupBilling().manageSubscription()

    expect(workspaceApi.getPaymentPortalUrl).toHaveBeenCalledOnce()
    expect(window.open).toHaveBeenCalledWith(
      'https://portal.legacy.example/session',
      '_blank'
    )
  })

  it('opens the SDK URL for the current page while the rail is on', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.openPaymentPortal).mockResolvedValue({
      status: 'ok',
      value: { url: 'https://portal.sdk.example/session' }
    })

    await setupBilling().manageSubscription()

    expect(harness.sdk.commands.openPaymentPortal).toHaveBeenCalledWith({
      returnUrl: window.location.href
    })
    expect(workspaceApi.getPaymentPortalUrl).not.toHaveBeenCalled()
    expect(window.open).toHaveBeenCalledWith(
      'https://portal.sdk.example/session',
      '_blank'
    )
  })

  it('falls back to the workspace client when the route is missing', async () => {
    flagState.billingSdkSubscriptionEnabled = true
    vi.mocked(harness.sdk.commands.openPaymentPortal).mockResolvedValue(
      ROUTE_MISSING
    )

    await setupBilling().manageSubscription()

    expect(workspaceApi.getPaymentPortalUrl).toHaveBeenCalledOnce()
    expect(window.open).toHaveBeenCalledWith(
      'https://portal.legacy.example/session',
      '_blank'
    )
  })
})
