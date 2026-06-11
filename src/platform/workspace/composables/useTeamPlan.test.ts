import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockIsActiveSubscription, mockSubscription, mockGetMaxSeats } =
  vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
    const { ref } = require('vue') as typeof import('vue')

    return {
      mockIsActiveSubscription: ref(true),
      mockSubscription: ref<{ tier: string } | null>({ tier: 'PRO' }),
      mockGetMaxSeats: vi.fn()
    }
  })

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: mockIsActiveSubscription,
    subscription: mockSubscription,
    getMaxSeats: mockGetMaxSeats
  })
}))

const SEATS_BY_KEY: Record<string, number> = {
  free: 1,
  standard: 1,
  creator: 5,
  pro: 20
}

async function setup() {
  const { useTeamPlan } = await import('./useTeamPlan')
  return useTeamPlan()
}

describe('useTeamPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsActiveSubscription.value = true
    mockSubscription.value = { tier: 'PRO' }
    mockGetMaxSeats.mockImplementation(
      (tierKey: string) => SEATS_BY_KEY[tierKey] ?? 1
    )
  })

  it('is off team plan when no active subscription', async () => {
    mockIsActiveSubscription.value = false
    const plan = await setup()
    expect(plan.isOnTeamPlan.value).toBe(false)
  })

  it('is off team plan for single-seat standard tier', async () => {
    mockSubscription.value = { tier: 'STANDARD' }
    const plan = await setup()
    expect(plan.isOnTeamPlan.value).toBe(false)
    expect(mockGetMaxSeats).toHaveBeenCalledWith('standard')
  })

  it('is on team plan for multi-seat tiers with active subscription', async () => {
    mockSubscription.value = { tier: 'CREATOR' }
    const plan = await setup()
    expect(plan.isOnTeamPlan.value).toBe(true)
    expect(plan.maxSeats.value).toBe(5)
    expect(mockGetMaxSeats).toHaveBeenCalledWith('creator')
  })

  it('falls back to one seat without a subscription tier', async () => {
    mockSubscription.value = null
    const plan = await setup()
    expect(plan.maxSeats.value).toBe(1)
    expect(plan.isOnTeamPlan.value).toBe(false)
    expect(mockGetMaxSeats).not.toHaveBeenCalled()
  })

  it('falls back to one seat for tiers missing from TIER_TO_KEY', async () => {
    mockSubscription.value = { tier: 'ENTERPRISE' }
    const plan = await setup()
    expect(plan.maxSeats.value).toBe(1)
    expect(plan.isOnTeamPlan.value).toBe(false)
    expect(mockGetMaxSeats).not.toHaveBeenCalled()
  })

  it('returns tier-mapped max seats', async () => {
    mockSubscription.value = { tier: 'PRO' }
    const plan = await setup()
    expect(plan.maxSeats.value).toBe(20)
    expect(mockGetMaxSeats).toHaveBeenCalledWith('pro')
  })
})
