import type { BillingStatusData } from '@comfyorg/account-core/billing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { fakeBillingSdk } from '@/platform/workspace/billing/sdk/billingSdkTestUtils'
import type { BillingSdk } from '@/platform/workspace/billing/sdk/createBillingSdk'
import { useWorkspaceBilling } from '@/platform/workspace/composables/useWorkspaceBilling'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { stubAccountIdentityPort } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('firebase/auth'))

const flagState = vi.hoisted(() => ({
  billingSdkTopupEnabled: false,
  billingSdkSubscriptionEnabled: false,
  unifiedCloudAuthEnabled: true
}))
vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({
    flags: {
      get billingSdkTopupEnabled() {
        return flagState.billingSdkTopupEnabled
      },
      get billingSdkTopupRailEnabled() {
        return (
          flagState.billingSdkTopupEnabled && flagState.unifiedCloudAuthEnabled
        )
      },
      get billingSdkSubscriptionRailEnabled() {
        return (
          flagState.billingSdkSubscriptionEnabled &&
          flagState.unifiedCloudAuthEnabled
        )
      },
      embeddedCheckoutEnabled: false
    }
  })
}))

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

vi.mock(import('@/platform/workspace/api/workspaceApi'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => ({ trackBillingEvent: vi.fn() })
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
  subscription_tier: 'CREATOR',
  plan_slug: 'creator-monthly'
}

let harness: ReturnType<typeof fakeBillingSdk>

const SCOPE = { userId: 'uid-1', workspaceId: 'ws-1', role: 'owner' as const }
const READ_AT = 1_700_000_000_000

/** The status the SDK's reader decodes, before the host projects it. */
const DECODED_STATUS: BillingStatusData = {
  is_active: true,
  max_seats: 1,
  occupied_seats: 1,
  has_funds: true,
  team_credit_stop: null,
  scheduled_change: null,
  subscription_tier: 'CREATOR',
  plan_slug: 'creator-monthly'
}

/** What the SDK's status reader publishes once the rail is on. */
function sdkStatus(overrides: Partial<BillingStatusData> = {}) {
  vi.mocked(harness.sdk.status.read).mockResolvedValue({
    status: 'ok',
    value: {
      status: { ...DECODED_STATUS, ...overrides },
      scope: SCOPE,
      readAt: READ_AT
    }
  })
}

function setupBilling() {
  const billing = effectScope().run(() => useWorkspaceBilling())
  if (!billing) throw new Error('Failed to create billing composable')
  return billing
}

beforeEach(() => {
  stubAccountIdentityPort()
  harness = fakeBillingSdk()
  mockCreateBillingSdk.mockReturnValue(harness.sdk)
  flagState.billingSdkSubscriptionEnabled = false
  flagState.unifiedCloudAuthEnabled = true
  vi.mocked(workspaceApi.getBillingStatus).mockResolvedValue(STATUS)
  vi.mocked(workspaceApi.getBillingBalance).mockResolvedValue({
    amount_micros: 0,
    currency: 'USD'
  })
  vi.mocked(useBillingOperationStore().startOperation).mockResolvedValue(
    undefined as never
  )
})

describe('useWorkspaceBilling top-up with the billing SDK flag', () => {
  it('issues through the workspace client while the flag is off', async () => {
    flagState.billingSdkTopupEnabled = false
    const response = {
      billing_op_id: 'op-1',
      topup_id: 'topup-1',
      status: 'completed' as const,
      amount_cents: 1000
    }
    vi.mocked(workspaceApi.createTopup).mockResolvedValue(response)

    await expect(setupBilling().topup(1000)).resolves.toBe(response)

    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('reattaches a pending top-up through the SDK instead of the poller', async () => {
    flagState.billingSdkTopupEnabled = true
    sdkStatus({
      pending_billing_op_id: 'op-1',
      pending_billing_op_type: 'topup'
    })

    await setupBilling().fetchStatus()

    expect(harness.sdk.lifecycle.recover).toHaveBeenCalledOnce()
    expect(useBillingOperationStore().startOperation).not.toHaveBeenCalled()
  })

  it('keeps a pending top-up on the poller while unified auth is off, whatever the SDK flag says', async () => {
    flagState.billingSdkTopupEnabled = true
    flagState.unifiedCloudAuthEnabled = false
    vi.mocked(workspaceApi.getBillingStatus).mockResolvedValue({
      ...STATUS,
      pending_billing_op_id: 'op-1',
      pending_billing_op_type: 'topup'
    })

    await setupBilling().fetchStatus()

    expect(useBillingOperationStore().startOperation).toHaveBeenCalledOnce()
    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('still hands a pending subscription to the poller', async () => {
    flagState.billingSdkTopupEnabled = true
    sdkStatus({
      pending_billing_op_id: 'op-sub',
      pending_billing_op_type: 'subscription'
    })

    await setupBilling().fetchStatus()

    expect(useBillingOperationStore().startOperation).toHaveBeenCalledWith(
      'op-sub',
      'subscription',
      undefined,
      undefined
    )
    expect(harness.sdk.lifecycle.recover).not.toHaveBeenCalled()
  })

  // Each kind of pending operation follows the rail that issues it. An
  // operation adopted on the other rail is the mid-session-flip ambiguity: its
  // writes went one way and its poller the other. A server predating
  // `pending_billing_op_type` only ever had subscriptions to hand back.
  it.for<{
    type: 'topup' | 'subscription' | undefined
    topupRail: boolean
    subscriptionRail: boolean
    adopter: 'SDK' | 'poller'
  }>([
    {
      type: 'subscription',
      topupRail: false,
      subscriptionRail: true,
      adopter: 'SDK'
    },
    {
      type: undefined,
      topupRail: false,
      subscriptionRail: true,
      adopter: 'SDK'
    },
    {
      type: 'topup',
      topupRail: false,
      subscriptionRail: true,
      adopter: 'poller'
    },
    {
      type: 'subscription',
      topupRail: true,
      subscriptionRail: false,
      adopter: 'poller'
    },
    {
      type: undefined,
      topupRail: true,
      subscriptionRail: false,
      adopter: 'poller'
    }
  ])(
    'a pending $type resumes on the $adopter with topup rail $topupRail and subscription rail $subscriptionRail',
    async ({ type, topupRail, subscriptionRail, adopter }) => {
      flagState.billingSdkTopupEnabled = topupRail
      flagState.billingSdkSubscriptionEnabled = subscriptionRail
      sdkStatus({
        pending_billing_op_id: 'op-pending',
        ...(type !== undefined && { pending_billing_op_type: type })
      })

      await setupBilling().fetchStatus()

      const onSdk = adopter === 'SDK'
      expect(harness.sdk.lifecycle.recover).toHaveBeenCalledTimes(onSdk ? 1 : 0)
      expect(useBillingOperationStore().startOperation).toHaveBeenCalledTimes(
        onSdk ? 0 : 1
      )
    }
  )
})

describe('useWorkspaceBilling reads with the billing SDK flag', () => {
  it('reads status and balance through the workspace client while the flag is off', async () => {
    flagState.billingSdkTopupEnabled = false
    const billing = setupBilling()

    await billing.fetchStatus()
    await billing.fetchBalance()

    expect(workspaceApi.getBillingStatus).toHaveBeenCalledOnce()
    expect(workspaceApi.getBillingBalance).toHaveBeenCalledOnce()
    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('reads status through the SDK reader and publishes what it decoded', async () => {
    flagState.billingSdkTopupEnabled = true
    sdkStatus({ subscription_tier: 'PRO' })
    const billing = setupBilling()

    await billing.fetchStatus()

    expect(workspaceApi.getBillingStatus).not.toHaveBeenCalled()
    expect(billing.tier.value).toBe('PRO')
    expect(billing.error.value).toBeNull()
  })

  it('reads through the SDK reader when only the subscription rail is on', async () => {
    flagState.billingSdkTopupEnabled = false
    flagState.billingSdkSubscriptionEnabled = true
    sdkStatus({ subscription_tier: 'PRO' })
    const billing = setupBilling()

    await billing.fetchStatus()

    expect(workspaceApi.getBillingStatus).not.toHaveBeenCalled()
    expect(billing.tier.value).toBe('PRO')
  })

  it('reports a status the host cannot hold exactly as a malformed read', async () => {
    flagState.billingSdkTopupEnabled = true
    sdkStatus({
      team_credit_stop: {
        id: 'team_huge',
        credits_monthly: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
        stop_usd: 200n
      }
    })
    const billing = setupBilling()

    await expect(billing.fetchStatus()).rejects.toThrow('MALFORMED_RESPONSE')

    expect(billing.tier.value).toBeNull()
    expect(billing.error.value).toBe('MALFORMED_RESPONSE')
  })

  it('reads the balance through the SDK reader', async () => {
    flagState.billingSdkTopupEnabled = true
    vi.mocked(harness.sdk.credits.read).mockResolvedValue({
      status: 'ok',
      value: {
        balance: { amount_micros: 5_000_000, currency: 'USD' },
        scope: SCOPE,
        readAt: READ_AT
      }
    })
    const billing = setupBilling()

    await billing.fetchBalance()

    expect(workspaceApi.getBillingBalance).not.toHaveBeenCalled()
    expect(billing.balance.value?.amountMicros).toBe(5_000_000)
  })

  it('keeps the previous state and reports nothing when the scope moved under a read', async () => {
    flagState.billingSdkTopupEnabled = true
    vi.mocked(harness.sdk.status.read).mockResolvedValue({
      status: 'error',
      code: 'SUPERSEDED'
    })
    const billing = setupBilling()

    await expect(billing.fetchStatus()).resolves.toBeUndefined()

    expect(billing.tier.value).toBeNull()
    expect(billing.error.value).toBeNull()
    expect(billing.isLoading.value).toBe(false)
  })

  it('surfaces a failed SDK read the way a failed client read is surfaced', async () => {
    flagState.billingSdkTopupEnabled = true
    vi.mocked(harness.sdk.credits.read).mockResolvedValue({
      status: 'error',
      code: 'REQUEST_FAILED'
    })
    const billing = setupBilling()

    await expect(billing.fetchBalance()).rejects.toThrow('REQUEST_FAILED')

    expect(billing.error.value).toBe('REQUEST_FAILED')
    expect(billing.isLoading.value).toBe(false)
  })
})
