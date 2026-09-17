import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { BillingTelemetryEvent } from '@/platform/telemetry/types'
import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import {
  fakeBillingSdk,
  settledOperation
} from '@/platform/workspace/billing/sdk/billingSdkTestUtils'
import type { BillingSdk } from '@/platform/workspace/billing/sdk/createBillingSdk'
import { useWorkspaceBilling } from '@/platform/workspace/composables/useWorkspaceBilling'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

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

vi.mock<unknown>(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog'),
  () => ({ useSubscriptionDialog: () => ({ show: vi.fn() }) })
)

vi.mock<unknown>(
  import('@/platform/workspace/composables/useBillingCapabilities'),
  () => ({
    useBillingCapabilities: () => ({ refresh: vi.fn(async () => undefined) })
  })
)

const trackBillingEvent = vi.hoisted(() =>
  vi.fn<(event: BillingTelemetryEvent) => void>()
)
vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => ({ trackBillingEvent })
}))

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

let harness: ReturnType<typeof fakeBillingSdk>

function setupBilling() {
  const billing = effectScope().run(() => useWorkspaceBilling())
  if (!billing) throw new Error('Failed to create billing composable')
  return billing
}

beforeEach(() => {
  trackBillingEvent.mockClear()
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
  vi.spyOn(window, 'open').mockReturnValue(null)
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
      'REQUEST_FAILED (500)'
    ],
    [{ status: 'error', code: 'SUPERSEDED' }, 'SUPERSEDED']
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
    trackBillingEvent.mock.calls.map(([event]) => event.stage)

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
    expect(trackBillingEvent).toHaveBeenLastCalledWith(
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
