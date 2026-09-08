import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
const mockRouterReplace = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: mockRouteQuery.value
  }),
  useRouter: () => ({
    replace: mockRouterReplace
  })
}))

const mockShowTopUpCreditsDialog = vi.hoisted(() =>
  vi.fn(async () => undefined)
)

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showTopUpCreditsDialog: mockShowTopUpCreditsDialog
  })
}))

const mockCanTopUp = vi.hoisted(() => ({ value: true }))
const mockCanSubscribeSelfServe = vi.hoisted(() => ({ value: false }))
const mockInitialize = vi.hoisted(() => vi.fn(async (): Promise<void> => {}))

vi.mock('@/platform/workspace/composables/useBillingCapabilities', () => ({
  useBillingCapabilities: () => ({
    canTopUp: mockCanTopUp,
    canSubscribeSelfServe: mockCanSubscribeSelfServe,
    initialize: mockInitialize
  })
}))

const mockTrackAddApiCreditButtonClicked = vi.hoisted(() => vi.fn())

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackAddApiCreditButtonClicked: mockTrackAddApiCreditButtonClicked
  })
}))

describe('useTopUpUrlLoader', () => {
  beforeEach(() => {
    mockRouteQuery.value = {}
    mockCanTopUp.value = true
    mockCanSubscribeSelfServe.value = false
    mockInitialize.mockResolvedValue(undefined)
    mockShowTopUpCreditsDialog.mockResolvedValue(undefined)
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
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

  it('retains the deep link until capability loading settles', async () => {
    let resolveCapabilities!: () => void
    mockRouteQuery.value = { topup: '1' }
    mockCanTopUp.value = false
    mockInitialize.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveCapabilities = resolve
        })
    )

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    const loading = loadTopUpFromUrl()
    await Promise.resolve()

    expect(mockRouterReplace).not.toHaveBeenCalled()
    expect(preservedQueryMocks.clearPreservedQuery).not.toHaveBeenCalled()

    mockCanTopUp.value = true
    resolveCapabilities()
    await loading

    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(mockShowTopUpCreditsDialog).toHaveBeenCalledOnce()
  })

  it('is a silent no-op when the server denies top-up', async () => {
    mockRouteQuery.value = { topup: '1' }
    mockCanTopUp.value = false

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(mockShowTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(mockTrackAddApiCreditButtonClicked).not.toHaveBeenCalled()
  })

  it('opens the subscription path without top-up telemetry', async () => {
    mockRouteQuery.value = { topup: '1' }
    mockCanTopUp.value = false
    mockCanSubscribeSelfServe.value = true

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(mockShowTopUpCreditsDialog).toHaveBeenCalledOnce()
    expect(mockTrackAddApiCreditButtonClicked).not.toHaveBeenCalled()
  })

  it('denies, strips, and clears together when the user is not eligible', async () => {
    mockRouteQuery.value = { topup: '1', other: 'param' }
    mockCanTopUp.value = false

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
    expect(mockInitialize).not.toHaveBeenCalled()
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
})
