import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'
import type { Plan } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { computed, nextTick } from 'vue'

vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/telemetry/reportError'))

/** Null is the legacy client; a rail is what the SDK store would hand back. */
const railState = vi.hoisted(() => ({
  rail: null as { readPlans: ReturnType<typeof vi.fn> } | null
}))
const identityState = vi.hoisted(() => ({ userId: 'user-1' }))
vi.mock<unknown>(import('@/composables/auth/useCurrentUser'), () => ({
  useCurrentUser: () => ({
    resolvedUserInfo: computed(() => ({ id: identityState.userId }))
  })
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
  beforeEach(() => {
    vi.resetModules()
    railState.rail = null
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-1'
    })
    identityState.userId = 'user-1'
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

    it('starts a new read when the workspace changes during a fetch', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      let resolveFirst: (value: { plans: Plan[] }) => void = () => {}
      vi.mocked(workspaceApi.getBillingPlans)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve
            })
        )
        .mockResolvedValueOnce({
          plans: [buildPlan({ slug: 'creator-monthly' })]
        })
      const { fetchPlans, plans } = useBillingPlans()

      const first = fetchPlans()
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-2'
      })
      const second = fetchPlans()
      await second
      resolveFirst({ plans: [buildPlan()] })
      await first

      expect(workspaceApi.getBillingPlans).toHaveBeenCalledTimes(2)
      expect(plans.value).toEqual([buildPlan({ slug: 'creator-monthly' })])
    })

    it('does not let an older read overwrite a newer read after returning to its scope', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      const resolvers: Array<(value: { plans: Plan[] }) => void> = []
      vi.mocked(workspaceApi.getBillingPlans).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve)
          })
      )
      const { fetchPlans, plans } = useBillingPlans()

      const firstA = fetchPlans()
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-2'
      })
      const workspaceB = fetchPlans()
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-1'
      })
      const secondA = fetchPlans()

      resolvers[2]({ plans: [buildPlan({ slug: 'new-a' })] })
      await secondA
      resolvers[0]({ plans: [buildPlan({ slug: 'old-a' })] })
      resolvers[1]({ plans: [buildPlan({ slug: 'workspace-b' })] })
      await Promise.all([firstA, workspaceB])

      expect(plans.value).toEqual([buildPlan({ slug: 'new-a' })])
    })

    it('reissues a read when its scope changes before the response arrives', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      let resolveFirst: (value: { plans: Plan[] }) => void = () => {}
      vi.mocked(workspaceApi.getBillingPlans)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve
            })
        )
        .mockResolvedValueOnce({
          plans: [buildPlan({ slug: 'creator-monthly' })]
        })
      const { fetchPlans, plans, error } = useBillingPlans()

      const first = fetchPlans()
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-2'
      })
      resolveFirst({ plans: [buildPlan()] })
      await first

      await vi.waitFor(() =>
        expect(plans.value).toEqual([buildPlan({ slug: 'creator-monthly' })])
      )
      expect(workspaceApi.getBillingPlans).toHaveBeenCalledTimes(2)
      expect(error.value).toBeNull()
    })

    it('reports an outright failure when no catalog was cached', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockRejectedValue(
        new Error('network down')
      )

      const { fetchPlans, error, isLoading, plans } = useBillingPlans()

      await fetchPlans()

      expect(error.value).toBe('network down')
      expect(isLoading.value).toBe(false)
      expect(plans.value).toEqual([])
      expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
        errorType: 'cloud_billing_plan_catalog_fallback',
        tags: {
          failure_kind: 'caught_unexpected',
          feature_area: 'billing',
          has_cached_plans: false,
          has_team_credit_stops: false,
          operation: 'load',
          outcome: 'failed'
        },
        level: 'error'
      })
    })

    it('reports a recovered fallback and preserves cached catalog state', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      const stops = {
        default_stop_index: 0,
        stops: [
          {
            id: 'team_700',
            credits: 147_700,
            monthly: { list_price_cents: 70_000, price_cents: 66_500 },
            yearly: { list_price_cents: 70_000, price_cents: 63_000 }
          }
        ]
      }
      vi.mocked(workspaceApi.getBillingPlans)
        .mockResolvedValueOnce({
          plans: [buildPlan()],
          team_credit_stops: stops
        })
        .mockRejectedValueOnce(new Error('network down'))

      const { fetchPlans, plans, teamCreditStops } = useBillingPlans()
      await fetchPlans()
      await fetchPlans()

      expect(plans.value).toEqual([buildPlan()])
      expect(teamCreditStops.value).toEqual(stops)
      expect(reportError).toHaveBeenLastCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            has_team_credit_stops: true,
            outcome: 'recovered'
          })
        })
      )
    })

    it('uses a fallback message when rejection is not an Error instance', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockRejectedValue('boom')

      const { fetchPlans, error } = useBillingPlans()

      await fetchPlans()

      expect(error.value).toBe('Failed to fetch plans')
    })

    it('reports a malformed plan list without throwing from the fallback', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValue({
        plans: undefined
      } as never)

      const { fetchPlans, plans } = useBillingPlans()
      await expect(fetchPlans()).resolves.toBeUndefined()

      expect(plans.value).toEqual([])
      expect(reportError).toHaveBeenCalledWith(
        expect.any(TypeError),
        expect.objectContaining({
          tags: expect.objectContaining({ outcome: 'failed' }),
          level: 'error'
        })
      )
    })

    it('rejects malformed team credit stops through the guarded fallback', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValue({
        plans: [buildPlan()],
        team_credit_stops: { stops: { invalid: true } }
      } as never)

      const { fetchPlans, teamCreditStops } = useBillingPlans()
      await expect(fetchPlans()).resolves.toBeUndefined()

      expect(teamCreditStops.value).toBeNull()
      expect(reportError).toHaveBeenCalledWith(
        expect.any(TypeError),
        expect.objectContaining({
          tags: expect.objectContaining({ outcome: 'failed' }),
          level: 'error'
        })
      )
    })

    it('accepts an explicit null team credit stop catalog', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValue({
        plans: [buildPlan()],
        team_credit_stops: null
      } as never)

      const { fetchPlans, plans, teamCreditStops } = useBillingPlans()
      await fetchPlans()

      expect(plans.value).toEqual([buildPlan()])
      expect(teamCreditStops.value).toBeNull()
      expect(reportError).not.toHaveBeenCalled()
    })

    it('clears the adopted catalog as soon as its workspace changes', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans).mockResolvedValue({
        plans: [buildPlan()],
        current_plan_slug: 'standard-monthly'
      })
      const { fetchPlans, plans, currentPlanSlug } = useBillingPlans()
      await fetchPlans()

      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-2'
      })
      await nextTick()

      expect(plans.value).toEqual([])
      expect(currentPlanSlug.value).toBeNull()
    })

    it('does not reissue a superseded catalog read after sign-out', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      let resolveRead: (value: { plans: Plan[] }) => void = () => {}
      vi.mocked(workspaceApi.getBillingPlans).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRead = resolve
          })
      )
      const { fetchPlans } = useBillingPlans()

      const pending = fetchPlans()
      identityState.userId = 'anonymous'
      resolveRead({ plans: [buildPlan()] })
      await pending

      expect(workspaceApi.getBillingPlans).toHaveBeenCalledOnce()
    })

    it('does not treat another workspace catalog as a recovered fallback', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      vi.mocked(workspaceApi.getBillingPlans)
        .mockResolvedValueOnce({ plans: [buildPlan()] })
        .mockRejectedValueOnce(new Error('network down'))
      const { fetchPlans, plans } = useBillingPlans()

      await fetchPlans()
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspaceId: 'workspace-2'
      })
      await fetchPlans()

      expect(plans.value).toEqual([])
      expect(reportError).toHaveBeenLastCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            has_cached_plans: false,
            outcome: 'failed'
          }),
          level: 'error'
        })
      )
    })

    it('does not reuse a personal catalog after the signed-in user changes', async () => {
      const { useBillingPlans, workspaceApi } = await importUseBillingPlans()
      Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: null })
      vi.mocked(workspaceApi.getBillingPlans)
        .mockResolvedValueOnce({ plans: [buildPlan()] })
        .mockResolvedValueOnce({
          plans: [buildPlan({ slug: 'creator-monthly' })]
        })
      const { fetchPlans, plans } = useBillingPlans()

      await fetchPlans()
      identityState.userId = 'user-2'
      await fetchPlans()

      expect(plans.value).toEqual([buildPlan({ slug: 'creator-monthly' })])
      expect(workspaceApi.getBillingPlans).toHaveBeenCalledTimes(2)
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
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'cloud_billing_plan_catalog_fallback',
          tags: expect.objectContaining({ outcome: 'failed' })
        })
      )
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
