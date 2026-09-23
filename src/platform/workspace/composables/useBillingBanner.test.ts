import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'

const mocks = vi.hoisted(() => ({
  billing: null as {
    canAccessSubscriptionFeatures: { value: boolean }
    isTeamPlan: { value: boolean }
    billingStatus: { value: string | null }
    subscription: { value: { hasFunds: boolean } | null }
    fetchStatus: ReturnType<typeof vi.fn>
    fetchBalance: ReturnType<typeof vi.fn>
  } | null
}))

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock<unknown>(
  import('@/composables/billing/useBillingContext'),
  async () => {
    const { ref } = await import('vue')
    const billing = {
      canAccessSubscriptionFeatures: ref(true),
      isTeamPlan: ref(true),
      billingStatus: ref<string | null>('paid'),
      subscription: ref<{ hasFunds: boolean } | null>({ hasFunds: true }),
      fetchStatus: vi.fn(),
      fetchBalance: vi.fn()
    }
    mocks.billing = billing
    return { useBillingContext: () => billing }
  }
)

vi.mock<unknown>(
  import('@/platform/workspace/composables/useWorkspaceUI'),
  async () => {
    const { computed } = await import('vue')
    return {
      useWorkspaceUI: () => ({
        permissions: computed(() => ({
          canManageSubscription: true,
          canManageSubscriptionLifecycle: true
        }))
      })
    }
  }
)

import { useBillingBanner as createBillingBanner } from './useBillingBanner'

describe('useBillingBanner', () => {
  let scope: EffectScope

  function useBillingBanner() {
    const banner = scope.run(createBillingBanner)
    if (!banner) throw new Error('Failed to create billing banner')
    return banner
  }

  beforeEach(() => {
    vi.mocked(useFeatureFlags().flags).billingControlEnabled = true
    vi.mocked(useFeatureFlags().flags).v1PaymentRecovery = true
    scope = effectScope()
    const b = mocks.billing!
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
