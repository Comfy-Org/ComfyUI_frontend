import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fakeBillingSdk,
  pendingTopup
} from '@/platform/workspace/billing/sdk/billingSdkTestUtils'
import type { BillingSdk } from '@/platform/workspace/billing/sdk/createBillingSdk'
import { billingOperation } from '@/platform/workspace/composables/billingOperationTestUtils'
import { useTopupOperation } from '@/platform/workspace/composables/useTopupOperation'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'

const flagState = vi.hoisted(() => ({ billingSdkTopupEnabled: false }))
vi.mock<unknown>(import('@/composables/useFeatureFlags'), () => ({
  useFeatureFlags: () => ({
    flags: {
      get billingSdkTopupEnabled() {
        return flagState.billingSdkTopupEnabled
      },
      embeddedCheckoutEnabled: false
    }
  })
}))

const mockCreateBillingSdk = vi.hoisted(() => vi.fn<() => BillingSdk>())
vi.mock(import('@/platform/workspace/billing/sdk/createBillingSdk'), () => ({
  createBillingSdk: mockCreateBillingSdk
}))

let harness: ReturnType<typeof fakeBillingSdk>

beforeEach(() => {
  harness = fakeBillingSdk()
  mockCreateBillingSdk.mockReturnValue(harness.sdk)
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
})
