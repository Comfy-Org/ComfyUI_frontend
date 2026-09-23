import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { CreateTopupResponse } from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import {
  fakeBillingSdk,
  pendingTopup,
  settledTopup
} from '@/platform/workspace/billing/sdk/billingSdkTestUtils'
import type { BillingSdk } from '@/platform/workspace/billing/sdk/createBillingSdk'
import { billingOperation } from '@/platform/workspace/composables/billingOperationTestUtils'
import { useTopupOperation } from '@/platform/workspace/composables/useTopupOperation'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { stubAccountIdentityPort } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('firebase/auth'))

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

const mockContextTopup = vi.hoisted(() =>
  vi.fn<(amountCents: number) => Promise<CreateTopupResponse | undefined>>()
)
vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/platform/telemetry'))

const mockCreateBillingSdk = vi.hoisted(() => vi.fn<() => BillingSdk>())
vi.mock(import('@/platform/workspace/billing/sdk/createBillingSdk'), () => ({
  createBillingSdk: mockCreateBillingSdk
}))

let harness: ReturnType<typeof fakeBillingSdk>

beforeEach(() => {
  stubAccountIdentityPort()
  const billingContext = useBillingContext()
  billingContext.topup = mockContextTopup
  vi.mocked(useBillingContext).mockReturnValue(billingContext)
  harness = fakeBillingSdk()
  mockCreateBillingSdk.mockReturnValue(harness.sdk)
  flagState.unifiedCloudAuthEnabled = true
})

describe('useTopupOperation', () => {
  it('reads and drives the poller while the SDK flag is off', async () => {
    flagState.billingSdkTopupEnabled = false
    const store = useBillingOperationStore()
    Object.assign(store, {
      isAddingCredits: true,
      topupActionOperation: billingOperation({
        type: 'topup',
        opId: 'op-poller'
      })
    })

    const view = useTopupOperation()
    await view.retryPaymentAuthentication('op-poller')
    view.dismissOperation('op-poller')

    expect(view.isAddingCredits.value).toBe(true)
    expect(view.topupOperation.value?.opId).toBe('op-poller')
    expect(store.retryPaymentAuthentication).toHaveBeenCalledWith('op-poller')
    expect(store.dismissOperation).toHaveBeenCalledWith('op-poller')
    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('reads and drives the SDK while the flag is on', async () => {
    flagState.billingSdkTopupEnabled = true
    const store = useBillingOperationStore()
    Object.assign(store, {
      topupActionOperation: billingOperation({
        type: 'topup',
        opId: 'op-poller'
      })
    })

    const view = useTopupOperation()
    harness.publish(pendingTopup({ actionUrl: 'https://verify.example/op-1' }))

    expect(view.isAddingCredits.value).toBe(true)
    expect(view.topupOperation.value?.opId).toBe('op-1')

    view.dismissOperation('op-1')
    expect(view.topupOperation.value).toBeUndefined()
    expect(store.dismissOperation).not.toHaveBeenCalled()
  })

  it('stays on the poller while unified auth is off, whatever the SDK flag says', () => {
    flagState.billingSdkTopupEnabled = true
    flagState.unifiedCloudAuthEnabled = false

    useTopupOperation()

    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('issues through the billing context while the SDK rail is off', async () => {
    flagState.billingSdkTopupEnabled = false
    const response: CreateTopupResponse = {
      billing_op_id: 'op-1',
      topup_id: 'topup-1',
      status: 'completed',
      amount_cents: 1000
    }
    mockContextTopup.mockResolvedValue(response)

    await expect(useTopupOperation().topup(1000)).resolves.toBe(response)

    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('issues through the SDK and keeps that rail after the flag flips', async () => {
    flagState.billingSdkTopupEnabled = true
    vi.mocked(harness.sdk.topup.createTopupCheckout).mockResolvedValue({
      status: 'ok',
      operation: settledTopup('succeeded'),
      creditsReconciled: true
    })
    const view = useTopupOperation()
    flagState.billingSdkTopupEnabled = false

    await expect(view.topup(1000)).resolves.toEqual({
      billing_op_id: 'op-1',
      topup_id: '',
      status: 'completed',
      amount_cents: 1000
    })
    expect(harness.sdk.topup.createTopupCheckout).toHaveBeenCalledWith({
      amountCents: 1000
    })
    expect(mockContextTopup).not.toHaveBeenCalled()
  })

  it.for([
    { rail: 'legacy', flagOn: false, registers: true },
    { rail: 'SDK', flagOn: true, registers: false }
  ])(
    'registers exactly one poller per pending top-up on the $rail rail',
    ({ flagOn, registers }) => {
      flagState.billingSdkTopupEnabled = flagOn
      const store = useBillingOperationStore()

      // Not awaited: the legacy registration settles only when the operation
      // does, which is the reason the dialog holds it as a promise.
      void useTopupOperation()
        .adoptPendingOperation('op-pending', { attemptStartedAt: 1000 })
        .catch(() => {})

      expect(store.startOperation).toHaveBeenCalledTimes(registers ? 1 : 0)
      if (registers) {
        expect(store.startOperation).toHaveBeenCalledWith(
          'op-pending',
          'topup',
          { attemptStartedAt: 1000, autoHandleRequiresAction: true }
        )
      }
    }
  )

  it('surfaces an SDK refusal as a workspace error', async () => {
    flagState.billingSdkTopupEnabled = true
    vi.mocked(harness.sdk.topup.createTopupCheckout).mockResolvedValue({
      status: 'error',
      code: 'REQUEST_FAILED',
      httpStatus: 503
    })

    const refusal = await useTopupOperation()
      .topup(1000)
      .catch((error: unknown) => error)

    expect(refusal).toBeInstanceOf(WorkspaceApiError)
    expect(refusal).toMatchObject({ status: 503, code: 'REQUEST_FAILED' })
  })
})
