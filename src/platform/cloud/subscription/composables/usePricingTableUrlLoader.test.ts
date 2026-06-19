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

const mockEnsureMembersLoaded = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    ensureMembersLoaded: mockEnsureMembersLoaded
  })
}))

const mockTrackSubscription = vi.hoisted(() => vi.fn())

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackSubscription: mockTrackSubscription })
}))

describe('usePricingTableUrlLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteQuery.value = {}
    mockPermissions.value = { canManageSubscriptionLifecycle: true }
    // clearAllMocks resets calls, not implementations, so restore the default
    // (a test overrides ensureMembersLoaded to flip the gate mid-await).
    mockEnsureMembersLoaded.mockResolvedValue(undefined)
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
    expect(mockTrackSubscription).toHaveBeenCalledWith('modal_opened', {
      reason: 'deep_link'
    })
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('reads the gate only after members finish loading', async () => {
    mockRouteQuery.value = { pricing: '1' }
    // The original owner becomes known only once the members list resolves;
    // proves the loader awaits ensureMembersLoaded before reading the gate.
    mockPermissions.value = { canManageSubscriptionLifecycle: false }
    mockEnsureMembersLoaded.mockImplementation(async () => {
      mockPermissions.value = { canManageSubscriptionLifecycle: true }
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
    expect(mockTrackSubscription).not.toHaveBeenCalled()
  })

  it('strips the param even when the user is not eligible', async () => {
    mockRouteQuery.value = { pricing: '1', other: 'param' }
    mockPermissions.value = { canManageSubscriptionLifecycle: false }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

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

  it('ignores empty param', async () => {
    mockRouteQuery.value = { pricing: '' }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).not.toHaveBeenCalled()
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('ignores non-string param', async () => {
    mockRouteQuery.value = { pricing: fromAny<string, unknown>(['array']) }

    const { loadPricingTableFromUrl } = usePricingTableUrlLoader()
    await loadPricingTableFromUrl()

    expect(mockShowPricingTable).not.toHaveBeenCalled()
  })
})
