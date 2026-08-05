import { fromAny } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTopUpUrlLoader } from './useTopUpUrlLoader'

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

const mockShowTopUpCreditsDialog = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
)

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showTopUpCreditsDialog: mockShowTopUpCreditsDialog
  })
}))

const mockPermissions = vi.hoisted(() => ({
  value: { canTopUp: true }
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({ permissions: mockPermissions })
}))

const mockBilling = vi.hoisted(() => ({
  fetchStatus: vi.fn().mockResolvedValue(undefined),
  subscription: { value: { isActive: true } as { isActive: boolean } | null },
  isActiveSubscription: { value: true },
  isFreeTier: { value: false }
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => mockBilling
}))

const mockTrackAddApiCreditButtonClicked = vi.hoisted(() => vi.fn())

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackAddApiCreditButtonClicked: mockTrackAddApiCreditButtonClicked
  })
}))

describe('useTopUpUrlLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteQuery.value = {}
    mockPermissions.value = { canTopUp: true }
    // clearAllMocks resets calls, not implementations, so restore the defaults.
    mockBilling.fetchStatus.mockResolvedValue(undefined)
    mockBilling.subscription.value = { isActive: true }
    mockBilling.isActiveSubscription.value = true
    mockBilling.isFreeTier.value = false
    mockShowTopUpCreditsDialog.mockResolvedValue(undefined)
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does nothing when no topup param present', async () => {
    mockRouteQuery.value = {}

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(mockShowTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('opens the top-up dialog for an eligible user and strips the param', async () => {
    mockRouteQuery.value = { topup: '1' }

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(mockShowTopUpCreditsDialog).toHaveBeenCalledOnce()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('emits deep_link telemetry on an eligible open', async () => {
    mockRouteQuery.value = { topup: '1' }

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(mockTrackAddApiCreditButtonClicked).toHaveBeenCalledWith({
      source: 'deep_link'
    })
  })

  it('awaits the status fetch before opening the dialog', async () => {
    mockRouteQuery.value = { topup: '1' }
    // The dialog picks top-up vs paywall from isActiveSubscription; holding
    // the fetch promise open proves the loader truly awaits it (a dropped
    // await would open the dialog before resolveStatus runs).
    let resolveStatus!: () => void
    mockBilling.fetchStatus.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStatus = resolve
        })
    )

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    const load = loadTopUpFromUrl()

    expect(mockBilling.fetchStatus).toHaveBeenCalledOnce()
    expect(mockShowTopUpCreditsDialog).not.toHaveBeenCalled()

    resolveStatus()
    await load

    expect(mockShowTopUpCreditsDialog).toHaveBeenCalledOnce()
  })

  it('bails silently when the status fetch resolves without a subscription state', async () => {
    mockRouteQuery.value = { topup: '1' }
    // The legacy billing adapter swallows fetch failures instead of
    // rejecting, leaving subscription null; a possibly-subscribed user must
    // not be routed to the paywall on that unknown state.
    mockBilling.subscription.value = null

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(mockShowTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(mockTrackAddApiCreditButtonClicked).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('opens without deep_link telemetry for a lapsed or free-tier user', async () => {
    mockRouteQuery.value = { topup: '1' }
    // showTopUpCreditsDialog routes this user to the paywall internally; the
    // deep_link source must only count real top-up dialog opens.
    mockBilling.isActiveSubscription.value = false

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(mockShowTopUpCreditsDialog).toHaveBeenCalledOnce()
    expect(mockTrackAddApiCreditButtonClicked).not.toHaveBeenCalled()
  })

  it('is a silent no-op for a team member', async () => {
    mockRouteQuery.value = { topup: '1' }
    mockPermissions.value = { canTopUp: false }

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(mockShowTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(mockBilling.fetchStatus).not.toHaveBeenCalled()
    expect(mockTrackAddApiCreditButtonClicked).not.toHaveBeenCalled()
  })

  it('denies, strips, and clears together when the user is not eligible', async () => {
    mockRouteQuery.value = { topup: '1', other: 'param' }
    mockPermissions.value = { canTopUp: false }

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(mockShowTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { other: 'param' }
    })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'topup'
    )
  })

  it('restores preserved query and opens the dialog', async () => {
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
      topup: '1'
    })

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
      'topup'
    )
    expect(mockShowTopUpCreditsDialog).toHaveBeenCalledOnce()
  })

  it('strips but does not open for an empty param', async () => {
    mockRouteQuery.value = { topup: '' }

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(mockShowTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'topup'
    )
  })

  it('strips but does not open for a non-string param', async () => {
    mockRouteQuery.value = { topup: fromAny<string, unknown>(['array']) }

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(mockShowTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('opens for an unrecognized topup value', async () => {
    mockRouteQuery.value = { topup: 'garbage' }

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(mockShowTopUpCreditsDialog).toHaveBeenCalledOnce()
  })

  it('strips and clears, then propagates a status-fetch failure', async () => {
    mockRouteQuery.value = { topup: '1' }
    mockBilling.fetchStatus.mockRejectedValue(new Error('status failed'))

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await expect(loadTopUpFromUrl()).rejects.toThrow('status failed')

    expect(mockShowTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(mockTrackAddApiCreditButtonClicked).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'topup'
    )
  })
})
