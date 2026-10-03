import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { computed, ref } from 'vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQueryRaw } from 'vue-router'

import type { TeamCreditStops } from '@/platform/workspace/api/workspaceApi'

import { usePricingTableUrlLoader } from './usePricingTableUrlLoader'

const preservedQueryMocks = vi.hoisted(() => ({
  clearPreservedQuery: vi.fn(),
  hydratePreservedQuery: vi.fn(),
  mergePreservedQueryIntoQuery: vi.fn()
}))

vi.mock(
  import('@/platform/navigation/preservedQueryManager'),
  () => preservedQueryMocks
)

vi.mock(import('vue-router'))

import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)

const mockPermissions = vi.hoisted(() => ({
  value: { canManageSubscription: true }
}))
const mockTeamCreditStops = ref<TeamCreditStops | null>(null)

vi.mock(import('@/composables/billing/useBillingContext'))

const mockCanOpenPricingSurface = vi.hoisted(() => ({ value: true }))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

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

function setRouteQuery(value: LocationQueryRaw) {
  const query = useRoute().query
  for (const key of Object.keys(query)) delete query[key]
  Object.assign(query, value)
}

describe('usePricingTableUrlLoader', () => {
  beforeEach(() => {
    const workspaceUI = useWorkspaceUI()
    const defaultPermissions = workspaceUI.permissions.value
    workspaceUI.permissions = computed(() => ({
      ...defaultPermissions,
      ...mockPermissions.value
    }))
    workspaceUI.canOpenPricingSurface = computed(
      () => mockCanOpenPricingSurface.value
    )
    const billing = useBillingContext()
    billing.teamCreditStops = computed(() => mockTeamCreditStops.value)
    vi.mocked(useBillingContext).mockReturnValue(billing)

    mockPermissions.value = { canManageSubscription: true }
    mockCanOpenPricingSurface.value = true

    mockTeamCreditStops.value = TEAM_CREDIT_STOPS
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  it('does nothing when no pricing param present', async () => {
    setRouteQuery({})

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
    expect(useRouter().replace).not.toHaveBeenCalled()
  })

  it('opens the pricing table for any owner capability', async () => {
    setRouteQuery({ pricing: '1' })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'deep_link' })
    )
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })

  it('never opens for a sales-managed workspace, even from a deep link', async () => {
    setRouteQuery({ pricing: '1' })
    mockCanOpenPricingSurface.value = false

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })

  it('resolves the capability snapshot before deciding', async () => {
    setRouteQuery({ pricing: '1' })
    mockCanOpenPricingSurface.value = true
    vi.mocked(useBillingCapabilities().initialize).mockImplementation(
      async () => {
        mockCanOpenPricingSurface.value = false
      }
    )

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useBillingCapabilities().initialize).toHaveBeenCalledOnce()
    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
  })

  it('opens on the team tab for ?pricing=team', async () => {
    setRouteQuery({ pricing: 'team' })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'deep_link', planMode: 'team' })
    )
  })

  it('opens on the personal tab for ?pricing=personal', async () => {
    setRouteQuery({ pricing: 'personal' })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'deep_link', planMode: 'personal' })
    )
  })

  it('opens the selected plan confirmation from a marketing deep link', async () => {
    setRouteQuery({ pricing: 'creator', cycle: 'monthly' })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'personal',
      initialCheckout: {
        planMode: 'personal',
        tierKey: 'creator',
        billingCycle: 'monthly'
      }
    })
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })

  it('is a silent no-op for a member', async () => {
    setRouteQuery({ pricing: '1' })
    mockPermissions.value = { canManageSubscription: false }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
  })

  it('denies selected-plan entry and strips its params for a member', async () => {
    setRouteQuery({
      pricing: 'creator',
      cycle: 'monthly',
      other: 'param'
    })
    mockPermissions.value = { canManageSubscription: false }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({
      query: { other: 'param' }
    })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'pricing'
    )
  })

  it('restores a preserved Team selection with its catalog values', async () => {
    setRouteQuery({})
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
    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith({
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
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })

  it('strips but does not open for an empty param', async () => {
    setRouteQuery({ pricing: '' })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'pricing'
    )
  })

  it('strips but does not open for a non-string param', async () => {
    setRouteQuery({ pricing: ['array'] })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })

  it('strips but does not open for an unrecognized pricing value', async () => {
    setRouteQuery({ pricing: 'garbage' })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })

  it.for<Record<string, string>>([
    { stop: 'team_700' },
    { cycle: 'monthly' },
    { stop: 'team_700', cycle: 'yearly', other: 'param' }
  ])('cleans orphaned pricing state: %o', async (query) => {
    setRouteQuery(query)

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({
      query: 'other' in query ? { other: 'param' } : {}
    })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'pricing'
    )
  })

  it('cleans orphaned pricing state restored from preservation', async () => {
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
      cycle: 'monthly',
      other: 'param'
    })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({
      query: { other: 'param' }
    })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'pricing'
    )
  })

  it.for<Record<string, string>>([
    { pricing: 'creator' },
    { pricing: 'creator', cycle: 'weekly' },
    { pricing: 'founder', cycle: 'yearly' }
  ])('strips but does not open an unsupported checkout: %o', async (query) => {
    setRouteQuery(query)

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
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
      setRouteQuery({
        pricing: 'team',
        stop: catalogStop.id,
        cycle: billingCycle
      })

      const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
      await loadPricingTableFromUrl()

      expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith({
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
      expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
    }
  )

  it('fetches the Team catalog before resolving a selected stop', async () => {
    setRouteQuery({
      pricing: 'team',
      stop: 'team_700',
      cycle: 'yearly'
    })
    mockTeamCreditStops.value = null
    vi.mocked(useBillingContext().fetchPlans).mockImplementationOnce(
      async () => {
        mockTeamCreditStops.value = TEAM_CREDIT_STOPS
      }
    )

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useBillingContext().fetchPlans).toHaveBeenCalledOnce()
    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith(
      expect.objectContaining({
        initialCheckout: expect.objectContaining({
          planMode: 'team',
          stop: expect.objectContaining({ id: 'team_700' })
        })
      })
    )
  })

  it('falls back to the Team table when the catalog fetch fails', async () => {
    setRouteQuery({
      pricing: 'team',
      stop: 'team_700',
      cycle: 'yearly'
    })
    mockTeamCreditStops.value = null
    vi.mocked(useBillingContext().fetchPlans).mockRejectedValueOnce(
      new Error('catalog unavailable')
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'team'
    })
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })

  it('falls back when the catalog remains unavailable after fetching', async () => {
    setRouteQuery({
      pricing: 'team',
      stop: 'team_700',
      cycle: 'yearly'
    })
    mockTeamCreditStops.value = null

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'team'
    })
  })

  it('falls back to the Team table for a stop absent from the catalog', async () => {
    setRouteQuery({
      pricing: 'team',
      stop: 'unknown',
      cycle: 'monthly'
    })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'team'
    })
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })

  it.for([
    { pricing: 'team', stop: 'team_700' },
    { pricing: 'team', cycle: 'yearly' },
    { pricing: 'team', stop: '', cycle: 'monthly' },
    { pricing: 'team', stop: 'team_700', cycle: 'weekly' },
    { pricing: 'personal', stop: 'team_700', cycle: 'yearly' }
  ])('fails closed for an invalid Team selection: %o', async (query) => {
    setRouteQuery(query)

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })

  it.for([
    { pricing: 'team', stop: ['team_700'], cycle: 'yearly' },
    { pricing: 'team', stop: 'team_700', cycle: ['yearly'] }
  ])('fails closed for array Team params: %o', async (query) => {
    setRouteQuery(query)

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })
})
