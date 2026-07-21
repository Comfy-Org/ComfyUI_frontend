import { fromAny } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TeamCreditStops } from '@/platform/workspace/api/workspaceApi'

import { usePricingTableUrlLoader } from './usePricingTableUrlLoader'

const preservedQueryMocks = vi.hoisted(() => ({
  clearPreservedQuery: vi.fn(),
  hydratePreservedQuery: vi.fn(),
  mergePreservedQueryIntoQuery: vi.fn()
}))

vi.mock(
  '@/platform/navigation/preservedQueryManager',
  () => preservedQueryMocks
)

const mockRouteQuery = vi.hoisted(() => ({
  value: {} as Record<string, string>
}))
const mockRouterReplace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: mockRouteQuery.value
  }),
  useRouter: () => ({
    replace: mockRouterReplace
  })
}))

const mockShowPricingTable = vi.hoisted(() => vi.fn())

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({
      showPricingTable: mockShowPricingTable
    })
  })
)

const mockPermissions = vi.hoisted(() => ({
  value: { canManageSubscription: true }
}))
const mockTeamCreditStops = vi.hoisted(() => ({
  value: null as TeamCreditStops | null
}))
const mockFetchPlans = vi.hoisted(() => vi.fn())

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    teamCreditStops: mockTeamCreditStops,
    fetchPlans: mockFetchPlans
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({ permissions: mockPermissions })
}))

const TEAM_CREDIT_STOPS = {
  default_stop_index: 2,
  stops: [200, 400, 700, 1400, 2500].map((usd, index) => ({
    id: `team_${usd}`,
    credits: usd * 211,
    monthly: {
      list_price_cents: usd * 100,
      price_cents: usd * 100 - index * 500
    },
    yearly: {
      list_price_cents: usd * 100,
      price_cents: usd * 100 - index * 1000
    }
  }))
} satisfies TeamCreditStops

describe('usePricingTableUrlLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteQuery.value = {}
    mockPermissions.value = { canManageSubscription: true }
    mockTeamCreditStops.value = TEAM_CREDIT_STOPS
    mockFetchPlans.mockResolvedValue(undefined)
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does nothing when no pricing param present', async () => {
    mockRouteQuery.value = {}

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).not.toHaveBeenCalled()
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('opens the pricing table for any owner capability', async () => {
    mockRouteQuery.value = { pricing: '1' }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: undefined,
      initialCheckout: undefined
    })
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('opens on the team tab for ?pricing=team', async () => {
    mockRouteQuery.value = { pricing: 'team' }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'team',
      initialCheckout: undefined
    })
  })

  it('opens on the personal tab for ?pricing=personal', async () => {
    mockRouteQuery.value = { pricing: 'personal' }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'personal',
      initialCheckout: undefined
    })
  })

  it('opens the selected plan confirmation from a marketing deep link', async () => {
    mockRouteQuery.value = { pricing: 'creator', cycle: 'monthly' }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'personal',
      initialCheckout: {
        planMode: 'personal',
        tierKey: 'creator',
        billingCycle: 'monthly'
      }
    })
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('is a silent no-op for a member', async () => {
    mockRouteQuery.value = { pricing: '1' }
    mockPermissions.value = { canManageSubscription: false }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).not.toHaveBeenCalled()
  })

  it('denies selected-plan entry and strips its params for a member', async () => {
    mockRouteQuery.value = {
      pricing: 'creator',
      cycle: 'monthly',
      other: 'param'
    }
    mockPermissions.value = { canManageSubscription: false }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { other: 'param' }
    })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'pricing'
    )
  })

  it('restores a preserved Team selection with its catalog values', async () => {
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
      pricing: 'team',
      stop: 'team_700',
      cycle: 'yearly'
    })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
      'pricing'
    )
    expect(mockShowPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'team',
      initialCheckout: {
        planMode: 'team',
        stop: {
          id: 'team_700',
          credits: 147700,
          usd: 700,
          discountedUsd: 680
        },
        billingCycle: 'yearly'
      }
    })
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('strips but does not open for an empty param', async () => {
    mockRouteQuery.value = { pricing: '' }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'pricing'
    )
  })

  it('strips but does not open for a non-string param', async () => {
    mockRouteQuery.value = { pricing: fromAny<string, unknown>(['array']) }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('strips but does not open for an unrecognized pricing value', async () => {
    mockRouteQuery.value = { pricing: 'garbage' }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it.for<Record<string, string>>([
    { pricing: 'creator' },
    { pricing: 'creator', cycle: 'weekly' },
    { pricing: 'founder', cycle: 'yearly' }
  ])('strips but does not open an unsupported checkout: %o', async (query) => {
    mockRouteQuery.value = query

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it.for(
    TEAM_CREDIT_STOPS.stops.flatMap((stop) =>
      (['monthly', 'yearly'] as const).map((billingCycle) => ({
        catalogStop: stop,
        billingCycle
      }))
    )
  )(
    'opens $catalogStop.id $billingCycle from the API catalog',
    async ({ catalogStop, billingCycle }) => {
      mockRouteQuery.value = {
        pricing: 'team',
        stop: catalogStop.id,
        cycle: billingCycle
      }

      const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
      await loadPricingTableFromUrl()

      expect(mockShowPricingTable).toHaveBeenCalledWith({
        reason: 'deep_link',
        planMode: 'team',
        initialCheckout: {
          planMode: 'team',
          stop: {
            id: catalogStop.id,
            credits: catalogStop.credits,
            usd: catalogStop[billingCycle].list_price_cents / 100,
            discountedUsd: catalogStop[billingCycle].price_cents / 100
          },
          billingCycle
        }
      })
      expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    }
  )

  it('fetches the Team catalog before resolving a selected stop', async () => {
    mockRouteQuery.value = {
      pricing: 'team',
      stop: 'team_700',
      cycle: 'yearly'
    }
    mockTeamCreditStops.value = null
    mockFetchPlans.mockImplementationOnce(async () => {
      mockTeamCreditStops.value = TEAM_CREDIT_STOPS
    })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockFetchPlans).toHaveBeenCalledOnce()
    expect(mockShowPricingTable).toHaveBeenCalledWith(
      expect.objectContaining({
        initialCheckout: expect.objectContaining({
          planMode: 'team',
          stop: expect.objectContaining({ id: 'team_700' })
        })
      })
    )
  })

  it.for([
    { pricing: 'team', stop: 'team_700' },
    { pricing: 'team', cycle: 'yearly' },
    { pricing: 'team', stop: 'unknown', cycle: 'monthly' },
    { pricing: 'team', stop: '', cycle: 'monthly' },
    { pricing: 'team', stop: 'team_700', cycle: 'weekly' },
    { pricing: 'personal', stop: 'team_700', cycle: 'yearly' }
  ])('fails closed for an invalid Team selection: %o', async (query) => {
    mockRouteQuery.value = fromAny<Record<string, string>, unknown>(query)

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it.for([
    { pricing: 'team', stop: ['team_700'], cycle: 'yearly' },
    { pricing: 'team', stop: 'team_700', cycle: ['yearly'] }
  ])('fails closed for array Team params: %o', async (query) => {
    mockRouteQuery.value = fromAny<Record<string, string>, unknown>(query)

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })
})
