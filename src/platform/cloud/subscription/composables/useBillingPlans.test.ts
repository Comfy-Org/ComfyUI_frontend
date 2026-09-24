import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Plan } from '@/platform/workspace/api/workspaceApi'

vi.mock(import('@/platform/workspace/api/workspaceApi'))

/** Null is the legacy client; a rail is what the SDK store would hand back. */
const railState = vi.hoisted(() => ({
  rail: null as { readPlans: ReturnType<typeof vi.fn> } | null
}))
vi.mock<unknown>(
  import('@/platform/workspace/composables/useBillingReadRail'),
  () => ({ useBillingReadRail: () => railState.rail })
)

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
  const [{ useBillingPlans }, { workspaceApi }] = await Promise.all([
    import('@/platform/cloud/subscription/composables/useBillingPlans'),
    import('@/platform/workspace/api/workspaceApi')
  ])
  return { useBillingPlans, workspaceApi }
}

describe('useBillingPlans', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    railState.rail = null
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe('fetchPlans', () => {
    it('populates plans and currentPlanSlug on success', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      const apiPlans = [
        buildPlan({ slug: 'standard-monthly', duration: 'MONTHLY' }),
        buildPlan({ slug: 'creator-annual', duration: 'ANNUAL' })
      ]
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValue({
        current_plan_slug: 'standard-monthly',
        plans: apiPlans
      })

      const { fetchPlans, plans, currentPlanSlug, error, isLoading } =
        useBillingPlans()

      await fetchPlans()

      expect(plans.value).toEqual(apiPlans)
      expect(currentPlanSlug.value).toBe('standard-monthly')
      expect(error.value).toBeNull()
      expect(isLoading.value).toBe(false)
    })

    it('normalizes missing current_plan_slug to null', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValue({
        plans: [buildPlan()]
      })

      const { fetchPlans, currentPlanSlug } = useBillingPlans()

      await fetchPlans()

      expect(currentPlanSlug.value).toBeNull()
    })

    it('populates teamCreditStops from the response', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      const stops = {
        default_stop_index: 2,
        stops: [
          {
            id: 'team_700',
            credits: 147_700,
            monthly: { list_price_cents: 70_000, price_cents: 66_500 },
            yearly: { list_price_cents: 70_000, price_cents: 63_000 }
          }
        ]
      }
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValue({
        plans: [buildPlan()],
        team_credit_stops: stops
      })

      const { fetchPlans, teamCreditStops } = useBillingPlans()

      await fetchPlans()

      expect(teamCreditStops.value).toEqual(stops)
    })

    it('leaves teamCreditStops null when the response omits it', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValue({
        plans: [buildPlan()]
      })

      const { fetchPlans, teamCreditStops } = useBillingPlans()

      await fetchPlans()

      expect(teamCreditStops.value).toBeNull()
    })

    it('dedupes concurrent calls while a fetch is in flight', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      let resolveFetch: (value: { plans: Plan[] }) => void = () => {}
      vi.mocked(workspaceApi.getBillingPlans).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve
          })
      )

      const { fetchPlans, isLoading, plans } = useBillingPlans()

      const first = fetchPlans()
      expect(isLoading.value).toBe(true)
      let secondResolved = false
      const second = fetchPlans().then(() => {
        secondResolved = true
      })

      await Promise.resolve()
      expect(secondResolved).toBe(false)

      resolveFetch({ plans: [buildPlan()] })
      await Promise.all([first, second])

      expect(workspaceApi.getBillingPlans).toHaveBeenCalledTimes(1)
      expect(plans.value).toEqual([buildPlan()])
      expect(isLoading.value).toBe(false)
    })

    it('captures Error messages into error.value and logs to console', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockRejectedValue(
        new Error('network down')
      )

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
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockRejectedValue('boom')

      const { fetchPlans, error } = useBillingPlans()

      await fetchPlans()

      expect(error.value).toBe('Failed to fetch plans')
    })

    it('clears previous error state when a new fetch succeeds', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockRejectedValueOnce(
        new Error('first failure')
      )
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValueOnce({
        plans: [buildPlan()]
      })

      const { fetchPlans, error } = useBillingPlans()

      await fetchPlans()
      expect(error.value).toBe('first failure')

      await fetchPlans()
      expect(error.value).toBeNull()
    })
  })

  describe('fetchPlans on the SDK rail', () => {
    it('adopts the catalog the SDK reader decoded and leaves the client alone', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      const apiPlans = [buildPlan()]
      const readPlans = vi.fn(async () => ({
        status: 'ok' as const,
        value: { current_plan_slug: 'standard-monthly', plans: apiPlans }
      }))
      railState.rail = { readPlans }

      const { fetchPlans, plans, currentPlanSlug } = useBillingPlans()
      await fetchPlans()

      expect(readPlans).toHaveBeenCalledOnce()
      expect(workspaceApi.getBillingPlans).not.toHaveBeenCalled()
      expect(plans.value).toEqual(apiPlans)
      expect(currentPlanSlug.value).toBe('standard-monthly')
    })

    it('keeps the previous catalog and reports nothing when the scope moved under the read', async () => {
      railState.rail = {
        readPlans: vi.fn(async () => ({
          status: 'error' as const,
          code: 'SUPERSEDED' as const
        }))
      }

      const { useBillingPlans } = await importUseBillingPlans()
      const { fetchPlans, plans, error, isLoading } = useBillingPlans()
      await fetchPlans()

      expect(plans.value).toEqual([])
      expect(error.value).toBeNull()
      expect(isLoading.value).toBe(false)
    })

    it('leaves a reported failure standing when the next read is superseded', async () => {
      railState.rail = {
        readPlans: vi
          .fn()
          .mockResolvedValueOnce({
            status: 'error' as const,
            code: 'REQUEST_FAILED' as const
          })
          .mockResolvedValueOnce({
            status: 'error' as const,
            code: 'SUPERSEDED' as const
          })
      }

      const { useBillingPlans } = await importUseBillingPlans()
      const { fetchPlans, plans, error } = useBillingPlans()

      await fetchPlans()
      const reported = error.value
      expect(reported).toBe('REQUEST_FAILED')

      await fetchPlans()

      // The superseded read published no catalog, so it may not clear the
      // explanation for the empty one already on screen.
      expect(plans.value).toEqual([])
      expect(error.value).toBe(reported)
    })

    it('surfaces a failed SDK read the way a failed client read is surfaced', async () => {
      railState.rail = {
        readPlans: vi.fn(async () => ({
          status: 'error' as const,
          code: 'REQUEST_FAILED' as const
        }))
      }

      const { useBillingPlans } = await importUseBillingPlans()
      const { fetchPlans, error } = useBillingPlans()
      await fetchPlans()

      expect(error.value).toBe('REQUEST_FAILED')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('computed plan lists', () => {
    it('partitions plans into monthly and annual by duration', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      const plans = [
        buildPlan({ slug: 'a-monthly', duration: 'MONTHLY' }),
        buildPlan({ slug: 'b-annual', duration: 'ANNUAL' }),
        buildPlan({ slug: 'c-monthly', duration: 'MONTHLY' })
      ]
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValue({ plans })

      const { fetchPlans, monthlyPlans, annualPlans } = useBillingPlans()

      await fetchPlans()

      expect(monthlyPlans.value.map((p) => p.slug)).toEqual([
        'a-monthly',
        'c-monthly'
      ])
      expect(annualPlans.value.map((p) => p.slug)).toEqual(['b-annual'])
    })

    it('returns empty arrays when no plans are loaded', async () => {
      const { useBillingPlans } = await importUseBillingPlans()
      const { monthlyPlans, annualPlans } = useBillingPlans()

      expect(monthlyPlans.value).toEqual([])
      expect(annualPlans.value).toEqual([])
    })
  })

  describe('lookup helpers', () => {
    it('getPlanBySlug finds an existing plan and returns undefined otherwise', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      const plan = buildPlan({ slug: 'creator-annual' })
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValue({
        plans: [plan]
      })

      const { fetchPlans, getPlanBySlug } = useBillingPlans()

      await fetchPlans()

      expect(getPlanBySlug('creator-annual')).toEqual(plan)
      expect(getPlanBySlug('missing')).toBeUndefined()
    })

    it('getPlansForTier filters plans by tier', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValue({
        plans: [
          buildPlan({ slug: 'standard-monthly', tier: 'STANDARD' }),
          buildPlan({ slug: 'creator-monthly', tier: 'CREATOR' }),
          buildPlan({ slug: 'creator-annual', tier: 'CREATOR' })
        ]
      })

      const { fetchPlans, getPlansForTier } = useBillingPlans()

      await fetchPlans()

      expect(getPlansForTier('CREATOR').map((p) => p.slug)).toEqual([
        'creator-monthly',
        'creator-annual'
      ])
      expect(getPlansForTier('PRO')).toEqual([])
    })

    it('isCurrentPlan reflects the loaded currentPlanSlug', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValue({
        current_plan_slug: 'standard-monthly',
        plans: [buildPlan()]
      })

      const { fetchPlans, isCurrentPlan } = useBillingPlans()

      expect(isCurrentPlan('standard-monthly')).toBe(false)

      await fetchPlans()

      expect(isCurrentPlan('standard-monthly')).toBe(true)
      expect(isCurrentPlan('creator-annual')).toBe(false)
    })
  })

  describe('shared module state', () => {
    it('shares refs across separate useBillingPlans() invocations', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValue({
        current_plan_slug: 'standard-monthly',
        plans: [buildPlan()]
      })

      const first = useBillingPlans()
      await first.fetchPlans()

      const second = useBillingPlans()
      expect(second.plans.value).toEqual(first.plans.value)
      expect(second.currentPlanSlug.value).toBe('standard-monthly')
      expect(second.isCurrentPlan('standard-monthly')).toBe(true)
    })
  })
})
