import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const mocks = vi.hoisted(() => ({
  billing: null as {
    isActiveSubscription: { value: boolean }
    isTeamPlan: { value: boolean }
    billingStatus: { value: string | null }
    subscription: { value: { hasFunds: boolean } | null }
  } | null,
  billingControlEnabled: null as { value: boolean } | null
}))

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

vi.mock('@/composables/useFeatureFlags', async () => {
  const { ref } = await import('vue')
  const billingControlEnabled = ref(true)
  mocks.billingControlEnabled = billingControlEnabled
  return {
    useFeatureFlags: () => ({
      flags: {
        get billingControlEnabled() {
          return billingControlEnabled.value
        }
      }
    })
  }
})

vi.mock('@/composables/billing/useBillingContext', async () => {
  const { ref } = await import('vue')
  const billing = {
    isActiveSubscription: ref(true),
    isTeamPlan: ref(true),
    billingStatus: ref<string | null>('paid'),
    subscription: ref<{ hasFunds: boolean } | null>({ hasFunds: true })
  }
  mocks.billing = billing
  return { useBillingContext: () => billing }
})

vi.mock('@/platform/workspace/composables/useWorkspaceUI', async () => {
  const { computed } = await import('vue')
  return {
    useWorkspaceUI: () => ({
      permissions: computed(() => ({
        canManageSubscription: true,
        canManageSubscriptionLifecycle: true,
        canTopUp: true
      }))
    })
  }
})

import { useBillingBanner } from './useBillingBanner'

describe('useBillingBanner', () => {
  beforeEach(() => {
    const b = mocks.billing!
    b.isActiveSubscription.value = true
    b.isTeamPlan.value = true
    b.billingStatus.value = 'paid'
    b.subscription.value = { hasFunds: true }
    mocks.billingControlEnabled!.value = true
  })

  it('suppresses the banner entirely when billing control is rolled back', async () => {
    const b = mocks.billing!
    const { kind } = useBillingBanner()

    b.subscription.value = { hasFunds: false }
    await nextTick()
    expect(kind.value).toBe('outOfCredits')

    mocks.billingControlEnabled!.value = false
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
})
