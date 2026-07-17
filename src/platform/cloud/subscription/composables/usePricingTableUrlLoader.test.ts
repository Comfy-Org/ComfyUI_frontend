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
  value: { canManageSubscriptionLifecycle: true }
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({ permissions: mockPermissions })
}))

const mockFetchMembers = vi.hoisted(() => vi.fn().mockResolvedValue([]))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    fetchMembers: mockFetchMembers
  })
}))

describe('usePricingTableUrlLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteQuery.value = {}
    mockPermissions.value = { canManageSubscriptionLifecycle: true }
    // clearAllMocks resets calls, not implementations, so restore the default
    // (a test overrides fetchMembers to flip the gate mid-await).
    mockFetchMembers.mockResolvedValue([])
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

  it('opens the pricing table for an original owner', async () => {
    mockRouteQuery.value = { pricing: '1' }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: undefined
    })
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('reads the gate only after members finish loading', async () => {
    mockRouteQuery.value = { pricing: '1' }
    // The original owner becomes known only once the members list resolves;
    // proves the loader awaits fetchMembers before reading the gate.
    mockPermissions.value = { canManageSubscriptionLifecycle: false }
    mockFetchMembers.mockImplementation(async () => {
      mockPermissions.value = { canManageSubscriptionLifecycle: true }
      return []
    })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).toHaveBeenCalledOnce()
  })

  it('opens on the team tab for ?pricing=team', async () => {
    mockRouteQuery.value = { pricing: 'team' }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'team'
    })
  })

  it('opens on the personal tab for ?pricing=personal', async () => {
    mockRouteQuery.value = { pricing: 'personal' }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: 'personal'
    })
  })

  it('is a silent no-op for a member or promoted owner', async () => {
    mockRouteQuery.value = { pricing: '1' }
    mockPermissions.value = { canManageSubscriptionLifecycle: false }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).not.toHaveBeenCalled()
  })

  it('denies, strips, and clears together when the user is not eligible', async () => {
    mockRouteQuery.value = { pricing: '1', other: 'param' }
    mockPermissions.value = { canManageSubscriptionLifecycle: false }

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
      pricing: '1'
    })

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
      'pricing'
    )
    expect(mockShowPricingTable).toHaveBeenCalledOnce()
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

  it('opens the default tab for an unrecognized pricing value', async () => {
    mockRouteQuery.value = { pricing: 'garbage' }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).toHaveBeenCalledWith({
      reason: 'deep_link',
      planMode: undefined
    })
  })

  it('strips and clears, then propagates a members-fetch failure', async () => {
    mockRouteQuery.value = { pricing: '1' }
    mockFetchMembers.mockRejectedValue(new Error('listMembers failed'))

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await expect(loadPricingTableFromUrl()).rejects.toThrow(
      'listMembers failed'
    )

    expect(mockShowPricingTable).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'pricing'
    )
  })
})
