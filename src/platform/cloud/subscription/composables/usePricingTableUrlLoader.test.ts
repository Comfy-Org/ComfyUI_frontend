import { fromAny } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({ permissions: mockPermissions })
}))

describe('usePricingTableUrlLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteQuery.value = {}
    mockPermissions.value = { canManageSubscription: true }
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

  it('restores preserved query and opens the table', async () => {
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
      pricing: 'pro',
      cycle: 'yearly'
    })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
      'pricing'
    )
    expect(mockShowPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'personal',
      initialCheckout: {
        tierKey: 'pro',
        billingCycle: 'yearly'
      }
    })
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
})
