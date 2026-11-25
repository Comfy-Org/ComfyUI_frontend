import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { BillingStatusData } from '@comfyorg/account-core/billing'

import type { BillingStatusResponse } from '@comfyorg/billing-core'
import { billingApi } from '@/platform/billing/api/billingApi'
import { fakeBillingSdk } from '@/platform/billing/sdk/billingSdkTestUtils'
import type { BillingSdk } from '@comfyorg/billing-core/sdk'
import { useWorkspaceBilling } from '@/platform/billing/composables/useWorkspaceBilling'
import { useBillingOperationStore } from '@/platform/billing/stores/billingOperationStore'
import { stubAccountIdentityPort } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('firebase/auth'))

const flagState = vi.hoisted(() => ({
  billingSdkRailEnabled: false
}))
vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({
    flags: {
      get billingSdkRailEnabled() {
        return flagState.billingSdkRailEnabled
      }
    }
  })
}))

vi.mock<unknown>(
  import('@/platform/billing/subscription/composables/useBillingPlans'),
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
  import('@/platform/billing/subscription/composables/useSubscriptionDialog')
)

vi.mock(import('@/platform/billing/api/billingApi'))

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

vi.mock(import('@comfyorg/telemetry'))

const mockCreateBillingSdk = vi.hoisted(() => vi.fn<() => BillingSdk>())
vi.mock(import('@comfyorg/billing-core/sdk'), () => ({
  createBillingSdk: mockCreateBillingSdk
}))

const STATUS: BillingStatusResponse = {
  ended_at: null,
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
  ended_at: null,
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
  flagState.billingSdkRailEnabled = false
  vi.mocked(billingApi.getBillingStatus).mockResolvedValue(STATUS)
  vi.mocked(billingApi.getBillingBalance).mockResolvedValue({
    amount_micros: 0,
    currency: 'USD'
  })
  vi.mocked(useBillingOperationStore().startOperation).mockResolvedValue(
    undefined as never
  )
})

describe('useWorkspaceBilling top-up with the billing SDK flag', () => {
  it('issues through the workspace client while the flag is off', async () => {
    flagState.billingSdkRailEnabled = false
    const response = {
      billing_op_id: 'op-1',
      topup_id: 'topup-1',
      status: 'completed' as const,
      amount_cents: 1000
    }
    vi.mocked(billingApi.createTopup).mockResolvedValue(response)

    await expect(setupBilling().topup(1000)).resolves.toBe(response)

    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('reattaches a pending top-up through the SDK instead of the poller', async () => {
    flagState.billingSdkRailEnabled = true
    sdkStatus({
      pending_billing_op_id: 'op-1',
      pending_billing_op_type: 'topup'
    })

    await setupBilling().fetchStatus()

    expect(harness.sdk.lifecycle.recover).toHaveBeenCalledOnce()
    expect(useBillingOperationStore().startOperation).not.toHaveBeenCalled()
  })

  it('keeps a pending top-up on the poller while the SDK rail is off', async () => {
    vi.mocked(billingApi.getBillingStatus).mockResolvedValue({
      ...STATUS,
      pending_billing_op_id: 'op-1',
      pending_billing_op_type: 'topup'
    })

    await setupBilling().fetchStatus()

    expect(useBillingOperationStore().startOperation).toHaveBeenCalledOnce()
    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it.for(['topup', 'subscription', undefined] as const)(
    'resumes a pending %s on the SDK while the rail is on',
    async (type) => {
      flagState.billingSdkRailEnabled = true
      sdkStatus({
        pending_billing_op_id: 'op-pending',
        ...(type !== undefined && { pending_billing_op_type: type })
      })

      await setupBilling().fetchStatus()

      expect(harness.sdk.lifecycle.recover).toHaveBeenCalledOnce()
      expect(useBillingOperationStore().startOperation).not.toHaveBeenCalled()
    }
  )
})

describe('useWorkspaceBilling reads with the billing SDK flag', () => {
  it('reads status and balance through the workspace client while the flag is off', async () => {
    flagState.billingSdkRailEnabled = false
    const billing = setupBilling()

    await billing.fetchStatus()
    await billing.fetchBalance()

    expect(billingApi.getBillingStatus).toHaveBeenCalledOnce()
    expect(billingApi.getBillingBalance).toHaveBeenCalledOnce()
    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('reads status through the SDK reader and publishes what it decoded', async () => {
    flagState.billingSdkRailEnabled = true
    sdkStatus({ subscription_tier: 'PRO' })
    const billing = setupBilling()

    await billing.fetchStatus()

    expect(billingApi.getBillingStatus).not.toHaveBeenCalled()
    expect(billing.tier.value).toBe('PRO')
    expect(billing.error.value).toBeNull()
  })

  it('asks the SDK readers for a read that does not join an earlier request when fresh', async () => {
    flagState.billingSdkRailEnabled = true
    sdkStatus({ subscription_tier: 'PRO' })
    vi.mocked(harness.sdk.credits.read).mockResolvedValue({
      status: 'ok',
      value: {
        balance: { amount_micros: 5_000_000, currency: 'USD' },
        scope: SCOPE,
        readAt: READ_AT
      }
    })
    const billing = setupBilling()

    await billing.fetchStatus({ fresh: true })
    await billing.fetchBalance({ fresh: true })

    expect(harness.sdk.status.read).toHaveBeenLastCalledWith({ fresh: true })
    expect(harness.sdk.credits.read).toHaveBeenLastCalledWith({ fresh: true })
  })

  it('reports a status the host cannot hold exactly as a malformed read', async () => {
    flagState.billingSdkRailEnabled = true
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
    flagState.billingSdkRailEnabled = true
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

    expect(billingApi.getBillingBalance).not.toHaveBeenCalled()
    expect(billing.balance.value?.amountMicros).toBe(5_000_000)
  })

  it('keeps the previous state and reports nothing when the scope moved under a read', async () => {
    flagState.billingSdkRailEnabled = true
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
    flagState.billingSdkRailEnabled = true
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
