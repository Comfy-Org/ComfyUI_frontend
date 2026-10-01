import { afterEach, describe, expect, it, vi } from 'vitest'

const mockSnapshot = vi.hoisted(() => ({ cloudFreeTier: false }))

vi.mock(import('../data/feature-flags.snapshot.json'), () => ({
  default: {
    fetchedAt: '2026-05-12T00:00:00.000Z',
    flags: mockSnapshot
  }
}))

async function loadPricingPlans(cloudFreeTier: boolean) {
  mockSnapshot.cloudFreeTier = cloudFreeTier
  vi.resetModules()

  const [{ SHOW_FREE_TIER }, { pricingPlans }] = await Promise.all([
    import('./features'),
    import('../data/pricingPlans')
  ])
  return { SHOW_FREE_TIER, pricingPlans }
}

describe('SHOW_FREE_TIER', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it.for([
    { cloudFreeTier: true, expectedPlanIds: ['free', 'standard'] },
    { cloudFreeTier: false, expectedPlanIds: ['standard', 'creator'] }
  ])(
    'sets the pricing-plan prefix when cloudFreeTier is $cloudFreeTier',
    async ({ cloudFreeTier, expectedPlanIds }) => {
      const { SHOW_FREE_TIER, pricingPlans } =
        await loadPricingPlans(cloudFreeTier)

      expect(SHOW_FREE_TIER).toBe(cloudFreeTier)
      expect(pricingPlans.slice(0, 2).map(({ id }) => id)).toEqual(
        expectedPlanIds
      )
    }
  )
})
