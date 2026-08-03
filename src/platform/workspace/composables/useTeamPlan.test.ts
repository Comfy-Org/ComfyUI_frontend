import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockIsActiveSubscription,
  mockIsInitialized,
  mockIsTeamPlan,
  mockSubscription,
  mockSubscriptionStatus
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  const { ref } = require('vue') as typeof import('vue')

  return {
    mockIsActiveSubscription: ref(true),
    mockIsInitialized: ref(true),
    mockIsTeamPlan: ref(true),
    mockSubscription: ref<{ isCancelled?: boolean } | null>({
      isCancelled: false
    }),
    mockSubscriptionStatus: ref<string | null>('active')
  }
})

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: mockIsActiveSubscription,
    isInitialized: mockIsInitialized,
    isTeamPlan: mockIsTeamPlan,
    subscription: mockSubscription,
    subscriptionStatus: mockSubscriptionStatus
  })
}))

async function setup() {
  const { useTeamPlan } = await import('./useTeamPlan')
  return useTeamPlan()
}

describe('useTeamPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsActiveSubscription.value = true
    mockIsInitialized.value = true
    mockIsTeamPlan.value = true
    mockSubscription.value = { isCancelled: false }
    mockSubscriptionStatus.value = 'active'
  })

  it('enables Team features from the active plan identity', async () => {
    const plan = await setup()
    expect(plan.hasTeamPlan.value).toBe(true)
    expect(plan.isOnTeamPlan.value).toBe(true)
  })

  it('does not enable Team features for a personal plan', async () => {
    mockIsTeamPlan.value = false
    const plan = await setup()
    expect(plan.hasTeamPlan.value).toBe(false)
    expect(plan.isOnTeamPlan.value).toBe(false)
  })

  it('does not enable Team features for an inactive subscription', async () => {
    mockIsActiveSubscription.value = false
    const plan = await setup()
    expect(plan.isOnTeamPlan.value).toBe(false)
  })

  it('reflects the cancelled state of the subscription', async () => {
    const plan = await setup()
    expect(plan.isCancelled.value).toBe(false)
    mockSubscription.value = { isCancelled: true }
    expect(plan.isCancelled.value).toBe(true)
    expect(plan.isOnTeamPlan.value).toBe(false)
  })

  it('treats a missing subscription as not cancelled', async () => {
    mockSubscription.value = null
    const plan = await setup()
    expect(plan.isCancelled.value).toBe(false)
  })

  it('flags a cancelled or ended Team plan as lapsed', async () => {
    const plan = await setup()
    mockSubscriptionStatus.value = 'canceled'
    expect(plan.hasLapsedTeamPlan.value).toBe(true)
    mockSubscriptionStatus.value = 'ended'
    expect(plan.hasLapsedTeamPlan.value).toBe(true)
  })

  it('does not flag a personal plan as a lapsed Team plan', async () => {
    mockIsTeamPlan.value = false
    mockSubscriptionStatus.value = 'ended'
    const plan = await setup()
    expect(plan.hasLapsedTeamPlan.value).toBe(false)
  })

  it('reports loading until billing initialization completes', async () => {
    mockIsInitialized.value = false
    const plan = await setup()
    expect(plan.isPlanLoading.value).toBe(true)
    mockIsInitialized.value = true
    expect(plan.isPlanLoading.value).toBe(false)
  })
})
