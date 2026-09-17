import { useDialogService } from '@/services/dialogService'
import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTelemetry } from '@/platform/telemetry'

import { useTopUpUrlLoader } from './useTopUpUrlLoader'

const preservedQueryMocks = vi.hoisted(() => ({
  clearPreservedQuery: vi.fn(),
  hydratePreservedQuery: vi.fn(),
  mergePreservedQueryIntoQuery: vi.fn()
}))

vi.mock(
  import('@/platform/navigation/preservedQueryManager'),
  () => preservedQueryMocks
)

const mockRouteQuery = vi.hoisted(() => ({
  value: {} as Record<string, string>
}))
const mockRouterReplace = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock<unknown>(import('vue-router'), () => ({
  useRoute: () => ({
    query: mockRouteQuery.value
  }),
  useRouter: () => ({
    replace: mockRouterReplace
  })
}))

vi.mock(import('@/services/dialogService'))

const mockCanTopUp = vi.hoisted(() => ({ value: true }))
const mockCanSubscribeSelfServe = vi.hoisted(() => ({ value: false }))
const mockInitialize = vi.hoisted(() => vi.fn(async (): Promise<void> => {}))

vi.mock<unknown>(
  import('@/platform/workspace/composables/useBillingCapabilities'),
  () => ({
    useBillingCapabilities: () => ({
      canTopUp: mockCanTopUp,
      canSubscribeSelfServe: mockCanSubscribeSelfServe,
      initialize: mockInitialize
    })
  })
)

vi.mock(import('@/platform/telemetry'))

describe('useTopUpUrlLoader', () => {
  beforeEach(() => {
    mockRouteQuery.value = {}
    mockCanTopUp.value = true
    mockCanSubscribeSelfServe.value = false
    mockInitialize.mockResolvedValue(undefined)
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  it('does nothing when no topup param present', async () => {
    mockRouteQuery.value = {}

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('opens the top-up dialog for an eligible user and strips the param', async () => {
    mockRouteQuery.value = { topup: '1' }

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledOnce()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('emits deep_link telemetry on an eligible open', async () => {
    mockRouteQuery.value = { topup: '1' }

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useTelemetry()?.trackAddApiCreditButtonClicked).toHaveBeenCalledWith(
      {
        source: 'deep_link'
      }
    )
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
    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledOnce()
  })

  it('is a silent no-op when the server denies top-up', async () => {
    mockRouteQuery.value = { topup: '1' }
    mockCanTopUp.value = false

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(
      useTelemetry()?.trackAddApiCreditButtonClicked
    ).not.toHaveBeenCalled()
  })

  it('opens the subscription path without top-up telemetry', async () => {
    mockRouteQuery.value = { topup: '1' }
    mockCanTopUp.value = false
    mockCanSubscribeSelfServe.value = true

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledOnce()
    expect(
      useTelemetry()?.trackAddApiCreditButtonClicked
    ).not.toHaveBeenCalled()
  })

  it('denies, strips, and clears together when the user is not eligible', async () => {
    mockRouteQuery.value = { topup: '1', other: 'param' }
    mockCanTopUp.value = false

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).not.toHaveBeenCalled()
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
    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledOnce()
  })

  it('strips but does not open for an empty param', async () => {
    mockRouteQuery.value = { topup: '' }

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).not.toHaveBeenCalled()
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

    expect(useDialogService().showTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('opens for an unrecognized topup value', async () => {
    mockRouteQuery.value = { topup: 'garbage' }

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledOnce()
  })
})
