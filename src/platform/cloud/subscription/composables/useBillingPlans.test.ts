import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Plan } from '@/platform/workspace/api/workspaceApi'

const { mockGetBillingPlans } = vi.hoisted(() => ({
  mockGetBillingPlans: vi.fn()
}))

vi.mock('@/platform/workspace/api/workspaceApi', () => ({
  workspaceApi: {
    getBillingPlans: mockGetBillingPlans
  }
}))

const buildPlan = (overrides: Partial<Plan> = {}): Plan => ({
  slug: 'standard-monthly',
  tier: 'STANDARD',
  duration: 'MONTHLY',
  price_cents: 2000,
  credits_cents: 4200,
  max_seats: 1,
  availability: { available: true },
  seat_summary: {
    seat_count: 1,
    total_cost_cents: 2000,
    total_credits_cents: 4200
  },
  ...overrides
})

const importUseBillingPlans = async () => {
  const mod =
    await import('@/platform/cloud/subscription/composables/useBillingPlans')
  return mod.useBillingPlans
}

describe('useBillingPlans', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    mockGetBillingPlans.mockReset()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('fetchPlans', () => {
    it('populates plans and currentPlanSlug on success', async () => {
      const apiPlans = [
        buildPlan({ slug: 'standard-monthly', duration: 'MONTHLY' }),
        buildPlan({ slug: 'creator-annual', duration: 'ANNUAL' })
      ]
      mockGetBillingPlans.mockResolvedValue({
        current_plan_slug: 'standard-monthly',
        plans: apiPlans
      })

      const useBillingPlans = await importUseBillingPlans()
      const { fetchPlans, plans, currentPlanSlug, error, isLoading } =
        useBillingPlans()

      await fetchPlans()

      expect(plans.value).toEqual(apiPlans)
      expect(currentPlanSlug.value).toBe('standard-monthly')
      expect(error.value).toBeNull()
      expect(isLoading.value).toBe(false)
    })

    it('normalizes missing current_plan_slug to null', async () => {
      mockGetBillingPlans.mockResolvedValue({ plans: [buildPlan()] })

      const useBillingPlans = await importUseBillingPlans()
      const { fetchPlans, currentPlanSlug } = useBillingPlans()

      await fetchPlans()

      expect(currentPlanSlug.value).toBeNull()
    })

    it('dedupes concurrent calls while a fetch is in flight', async () => {
      let resolveFetch: (value: { plans: Plan[] }) => void = () => {}
      mockGetBillingPlans.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve
          })
      )

      const useBillingPlans = await importUseBillingPlans()
      const { fetchPlans, isLoading } = useBillingPlans()

      const first = fetchPlans()
      expect(isLoading.value).toBe(true)
      const second = fetchPlans()

      resolveFetch({ plans: [buildPlan()] })
      await Promise.all([first, second])

      expect(mockGetBillingPlans).toHaveBeenCalledTimes(1)
      expect(isLoading.value).toBe(false)
    })

    it('captures Error messages into error.value and logs to console', async () => {
      mockGetBillingPlans.mockRejectedValue(new Error('network down'))

      const useBillingPlans = await importUseBillingPlans()
      const { fetchPlans, error, isLoading, plans } = useBillingPlans()

      await fetchPlans()

      expect(error.value).toBe('network down')
      expect(isLoading.value).toBe(false)
      expect(plans.value).toEqual([])
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[useBillingPlans] Failed to fetch plans:',
        expect.any(Error)
      )
    })

    it('uses a fallback message when rejection is not an Error instance', async () => {
      mockGetBillingPlans.mockRejectedValue('boom')

      const useBillingPlans = await importUseBillingPlans()
      const { fetchPlans, error } = useBillingPlans()

      await fetchPlans()

      expect(error.value).toBe('Failed to fetch plans')
    })

    it('clears previous error state when a new fetch succeeds', async () => {
      mockGetBillingPlans.mockRejectedValueOnce(new Error('first failure'))
      mockGetBillingPlans.mockResolvedValueOnce({ plans: [buildPlan()] })

      const useBillingPlans = await importUseBillingPlans()
      const { fetchPlans, error } = useBillingPlans()

      await fetchPlans()
      expect(error.value).toBe('first failure')

      await fetchPlans()
      expect(error.value).toBeNull()
    })
  })

  describe('computed plan lists', () => {
    it('partitions plans into monthly and annual by duration', async () => {
      const plans = [
        buildPlan({ slug: 'a-monthly', duration: 'MONTHLY' }),
        buildPlan({ slug: 'b-annual', duration: 'ANNUAL' }),
        buildPlan({ slug: 'c-monthly', duration: 'MONTHLY' })
      ]
      mockGetBillingPlans.mockResolvedValue({ plans })

      const useBillingPlans = await importUseBillingPlans()
      const { fetchPlans, monthlyPlans, annualPlans } = useBillingPlans()

      await fetchPlans()

      expect(monthlyPlans.value.map((p) => p.slug)).toEqual([
        'a-monthly',
        'c-monthly'
      ])
      expect(annualPlans.value.map((p) => p.slug)).toEqual(['b-annual'])
    })

    it('returns empty arrays when no plans are loaded', async () => {
      const useBillingPlans = await importUseBillingPlans()
      const { monthlyPlans, annualPlans } = useBillingPlans()

      expect(monthlyPlans.value).toEqual([])
      expect(annualPlans.value).toEqual([])
    })
  })

  describe('lookup helpers', () => {
    it('getPlanBySlug finds an existing plan and returns undefined otherwise', async () => {
      const plan = buildPlan({ slug: 'creator-annual' })
      mockGetBillingPlans.mockResolvedValue({ plans: [plan] })

      const useBillingPlans = await importUseBillingPlans()
      const { fetchPlans, getPlanBySlug } = useBillingPlans()

      await fetchPlans()

      expect(getPlanBySlug('creator-annual')).toEqual(plan)
      expect(getPlanBySlug('missing')).toBeUndefined()
    })

    it('getPlansForTier filters plans by tier', async () => {
      mockGetBillingPlans.mockResolvedValue({
        plans: [
          buildPlan({ slug: 'standard-monthly', tier: 'STANDARD' }),
          buildPlan({ slug: 'creator-monthly', tier: 'CREATOR' }),
          buildPlan({ slug: 'creator-annual', tier: 'CREATOR' })
        ]
      })

      const useBillingPlans = await importUseBillingPlans()
      const { fetchPlans, getPlansForTier } = useBillingPlans()

      await fetchPlans()

      expect(getPlansForTier('CREATOR').map((p) => p.slug)).toEqual([
        'creator-monthly',
        'creator-annual'
      ])
      expect(getPlansForTier('PRO')).toEqual([])
    })

    it('isCurrentPlan reflects the loaded currentPlanSlug', async () => {
      mockGetBillingPlans.mockResolvedValue({
        current_plan_slug: 'standard-monthly',
        plans: [buildPlan()]
      })

      const useBillingPlans = await importUseBillingPlans()
      const { fetchPlans, isCurrentPlan } = useBillingPlans()

      expect(isCurrentPlan('standard-monthly')).toBe(false)

      await fetchPlans()

      expect(isCurrentPlan('standard-monthly')).toBe(true)
      expect(isCurrentPlan('creator-annual')).toBe(false)
    })
  })

  describe('shared module state', () => {
    it('shares refs across separate useBillingPlans() invocations', async () => {
      mockGetBillingPlans.mockResolvedValue({
        current_plan_slug: 'standard-monthly',
        plans: [buildPlan()]
      })

      const useBillingPlans = await importUseBillingPlans()
      const first = useBillingPlans()
      await first.fetchPlans()

      const second = useBillingPlans()
      expect(second.plans.value).toEqual(first.plans.value)
      expect(second.currentPlanSlug.value).toBe('standard-monthly')
      expect(second.isCurrentPlan('standard-monthly')).toBe(true)
    })
  })
})
