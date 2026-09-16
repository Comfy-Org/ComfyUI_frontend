import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { fakeBillingSdk } from '@/platform/workspace/billing/sdk/billingSdkTestUtils'
import type { BillingSdk } from '@/platform/workspace/billing/sdk/createBillingSdk'
import { useWorkspaceBilling } from '@/platform/workspace/composables/useWorkspaceBilling'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

const flagState = vi.hoisted(() => ({
  billingSdkTopupEnabled: false,
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

function setupBilling() {
  const billing = effectScope().run(() => useWorkspaceBilling())
  if (!billing) throw new Error('Failed to create billing composable')
  return billing
}

beforeEach(() => {
  harness = fakeBillingSdk()
  mockCreateBillingSdk.mockReturnValue(harness.sdk)
  flagState.unifiedCloudAuthEnabled = true
  vi.spyOn(workspaceApi, 'getBillingStatus').mockResolvedValue(STATUS)
  vi.spyOn(workspaceApi, 'getBillingBalance').mockResolvedValue({
    amount_micros: 0,
    currency: 'USD'
  })
  vi.spyOn(workspaceApi, 'createTopup')
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
    vi.mocked(workspaceApi.getBillingStatus).mockResolvedValue({
      ...STATUS,
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
    vi.mocked(workspaceApi.getBillingStatus).mockResolvedValue({
      ...STATUS,
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
    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })
})
