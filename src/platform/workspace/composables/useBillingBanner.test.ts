import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, nextTick, ref } from 'vue'
import type { EffectScope } from 'vue'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { SubscriptionInfo } from '@/composables/billing/types'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { BillingStatus } from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

const mocks = vi.hoisted(() => ({
  billing: null as {
    canAccessSubscriptionFeatures: { value: boolean }
    isTeamPlan: { value: boolean }
    billingStatus: { value: BillingStatus | null }
    subscription: { value: Pick<SubscriptionInfo, 'hasFunds'> | null }
    fetchStatus: ReturnType<typeof vi.fn>
    fetchBalance: ReturnType<typeof vi.fn>
  } | null
}))

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

import { useBillingBanner as createBillingBanner } from './useBillingBanner'

describe('useBillingBanner', () => {
  let scope: EffectScope

  function useBillingBanner() {
    const banner = scope.run(createBillingBanner)
    if (!banner) throw new Error('Failed to create billing banner')
    return banner
  }

  beforeEach(() => {
    const billing = {
      canAccessSubscriptionFeatures: ref(true),
      isTeamPlan: ref(true),
      billingStatus: ref<BillingStatus | null>('paid'),
      subscription: ref<Pick<SubscriptionInfo, 'hasFunds'> | null>({
        hasFunds: true
      }),
      fetchStatus: vi.fn(),
      fetchBalance: vi.fn()
    }
    mocks.billing = billing
    const billingContext = useBillingContext()
    billingContext.canAccessSubscriptionFeatures = computed(
      () => billing.canAccessSubscriptionFeatures.value
    )
    billingContext.isTeamPlan = computed(() => billing.isTeamPlan.value)
    billingContext.billingStatus = computed(() => billing.billingStatus.value)
    billingContext.subscription = computed(() =>
      billing.subscription.value
        ? {
            isActive: true,
            tier: null,
            duration: null,
            planSlug: null,
            scheduledChange: null,
            renewalDate: null,
            endDate: null,
            isCancelled: false,
            ...billing.subscription.value
          }
        : null
    )
    billingContext.fetchStatus = billing.fetchStatus
    billingContext.fetchBalance = billing.fetchBalance
    vi.mocked(useBillingContext).mockReturnValue(billingContext)
    const workspaceUI = vi.mocked(useWorkspaceUI())
    const defaultPermissions = workspaceUI.permissions.value
    workspaceUI.permissions = computed(() => ({
      ...defaultPermissions,
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true
    }))
    vi.mocked(useFeatureFlags().flags).billingControlEnabled = true
    vi.mocked(useFeatureFlags().flags).v1PaymentRecovery = true
    scope = effectScope()
    const b = mocks.billing
    b.canAccessSubscriptionFeatures.value = true
    b.isTeamPlan.value = true
    b.billingStatus.value = 'paid'
    b.subscription.value = { hasFunds: true }
  })

  afterEach(() => scope.stop())

  it('suppresses the banner entirely when billing control is rolled back', async () => {
    vi.mocked(useFeatureFlags().flags).billingControlEnabled = true

    const b = mocks.billing!
    const { kind } = useBillingBanner()

    b.subscription.value = { hasFunds: false }
    await nextTick()
    expect(kind.value).toBe('outOfCredits')

    vi.mocked(useFeatureFlags().flags).billingControlEnabled = false
    await nextTick()
    expect(kind.value).toBeNull()
  })

  it('re-shows the out-of-credits banner after a top-up and a later exhaustion', async () => {
    const b = mocks.billing!
    const { kind, dismiss } = useBillingBanner()

    b.subscription.value = { hasFunds: false }
    await nextTick()
    expect(kind.value).toBe('outOfCredits')

    dismiss()
    await nextTick()
    expect(kind.value).toBeNull()

    b.subscription.value = { hasFunds: true }
    await nextTick()
    b.subscription.value = { hasFunds: false }
    await nextTick()
    expect(kind.value).toBe('outOfCredits')
  })

  it('refreshes status and balance on focus while payment recovery is visible', async () => {
    const b = mocks.billing!
    useBillingBanner()
    b.billingStatus.value = 'payment_failed'

    window.dispatchEvent(new Event('focus'))
    await nextTick()

    expect(b.fetchStatus).toHaveBeenCalledOnce()
    expect(b.fetchBalance).toHaveBeenCalledOnce()
  })

  it('does not refresh payment recovery on focus when the flag is off', async () => {
    vi.mocked(useFeatureFlags().flags).v1PaymentRecovery = true

    const b = mocks.billing!
    useBillingBanner()
    b.billingStatus.value = 'payment_failed'
    vi.mocked(useFeatureFlags().flags).v1PaymentRecovery = false

    window.dispatchEvent(new Event('focus'))
    await nextTick()

    expect(b.fetchStatus).not.toHaveBeenCalled()
    expect(b.fetchBalance).not.toHaveBeenCalled()
  })
})
