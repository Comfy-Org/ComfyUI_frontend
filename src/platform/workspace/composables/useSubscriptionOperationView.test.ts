import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock(import('firebase/auth'))

import {
  fakeBillingSdk,
  pendingSubscription
} from '@/platform/workspace/billing/sdk/billingSdkTestUtils'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { BillingSdk } from '@/platform/workspace/billing/sdk/createBillingSdk'
import { billingOperation } from '@/platform/workspace/composables/billingOperationTestUtils'
import { useSubscriptionOperationView } from '@/platform/workspace/composables/useSubscriptionRail'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { stubAccountIdentityPort } from '@/utils/__tests__/stubAccountIdentityPort'

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))
vi.mock(import('@/platform/telemetry'))

const mockCreateBillingSdk = vi.hoisted(() => vi.fn<() => BillingSdk>())
vi.mock(import('@/platform/workspace/billing/sdk/createBillingSdk'), () => ({
  createBillingSdk: mockCreateBillingSdk
}))

let harness: ReturnType<typeof fakeBillingSdk>

/** The operation the panel renders for: setting up, with a step still owed. */
const HOSTED_STEP = 'https://pay.example/verify'

beforeEach(() => {
  stubAccountIdentityPort()
  harness = fakeBillingSdk()
  mockCreateBillingSdk.mockReturnValue(harness.sdk)
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-1' })
  // The store opens a hosted step itself when one arrives; the real open
  // would have happy-dom fetch the fixture URL.
  vi.spyOn(window, 'open').mockReturnValue(window)
})

describe('useSubscriptionOperationView', () => {
  it('reads the poller while the rail is off', () => {
    vi.mocked(useFeatureFlags().flags).billingSdkSubscriptionRailEnabled = false
    Object.assign(useBillingOperationStore(), {
      isSettingUp: true,
      subscriptionActionOperation: billingOperation({
        workspaceId: 'ws-1',
        actionUrl: HOSTED_STEP
      })
    })

    const view = useSubscriptionOperationView()

    expect(view.isSettingUp.value).toBe(true)
    expect(view.subscriptionActionUrl.value).toBe(HOSTED_STEP)
    expect(mockCreateBillingSdk).not.toHaveBeenCalled()
  })

  it('reads the SDK lifecycle while the rail is on, and not the poller', () => {
    vi.mocked(useFeatureFlags().flags).billingSdkSubscriptionRailEnabled = true
    Object.assign(useBillingOperationStore(), {
      isSettingUp: false,
      subscriptionActionOperation: undefined
    })

    const view = useSubscriptionOperationView()
    harness.publish(pendingSubscription({ actionUrl: HOSTED_STEP }))

    expect(view.isSettingUp.value).toBe(true)
    expect(view.subscriptionActionUrl.value).toBe(HOSTED_STEP)
  })

  // SDK rail only. The legacy store's own predicates filter on the active
  // workspace inside computeds over a private `operations` ref, so a test at
  // this level can only overwrite their results, not drive them — a legacy row
  // here would assert the value it just assigned. `billingOperationStore`'s
  // suite holds that side; this holds the projection the rail publishes.
  it('offers no hosted step for another workspace on the SDK rail', () => {
    vi.mocked(useFeatureFlags().flags).billingSdkSubscriptionRailEnabled = true

    const view = useSubscriptionOperationView()
    harness.publish(pendingSubscription({ actionUrl: HOSTED_STEP }))
    expect(view.isSettingUp.value).toBe(true)
    // Pinned before the switch too, or a view that always answers null would
    // pass the assertion after it.
    expect(view.subscriptionActionUrl.value).toBe(HOSTED_STEP)

    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'ws-other' })

    expect(view.isSettingUp.value).toBe(false)
    expect(view.subscriptionActionUrl.value).toBeNull()
  })

  it('refuses a hosted step that is not https on the SDK rail', () => {
    vi.mocked(useFeatureFlags().flags).billingSdkSubscriptionRailEnabled = true

    const view = useSubscriptionOperationView()
    harness.publish(pendingSubscription({ actionUrl: 'javascript:alert(1)' }))

    expect(view.isSettingUp.value).toBe(true)
    expect(view.subscriptionActionUrl.value).toBeNull()
  })
})
