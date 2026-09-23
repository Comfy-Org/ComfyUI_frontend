import { computed, ref } from 'vue'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useDialogService } from '@/services/dialogService'
import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQueryRaw } from 'vue-router'

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

vi.mock(import('vue-router'))

vi.mock(import('@/services/dialogService'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/platform/telemetry'))

function setRouteQuery(value: LocationQueryRaw) {
  const query = useRoute().query
  for (const key of Object.keys(query)) delete query[key]
  Object.assign(query, value)
}

describe('useTopUpUrlLoader', () => {
  beforeEach(() => {
    setRouteQuery({})
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  it('does nothing when no topup param present', async () => {
    setRouteQuery({})

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(useRouter().replace).not.toHaveBeenCalled()
  })

  it('opens the top-up dialog for an eligible user and strips the param', async () => {
    setRouteQuery({ topup: '1' })

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledOnce()
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })

  it('emits deep_link telemetry on an eligible open', async () => {
    setRouteQuery({ topup: '1' })

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useTelemetry()?.trackAddApiCreditButtonClicked).toHaveBeenCalledWith(
      {
        source: 'deep_link'
      }
    )
  })

  it('retains the deep link until capability loading settles', async () => {
    const canTopUp = ref(false)
    useBillingCapabilities().canTopUp = computed(() => canTopUp.value)

    let resolveCapabilities!: () => void
    setRouteQuery({ topup: '1' })
    vi.mocked(useBillingCapabilities().initialize).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveCapabilities = resolve
        })
    )

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    const loading = loadTopUpFromUrl()
    await Promise.resolve()

    expect(useRouter().replace).not.toHaveBeenCalled()
    expect(preservedQueryMocks.clearPreservedQuery).not.toHaveBeenCalled()

    canTopUp.value = true
    resolveCapabilities()
    await loading

    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledOnce()
  })

  it('is a silent no-op when the server denies top-up', async () => {
    setRouteQuery({ topup: '1' })
    useBillingCapabilities().canTopUp = computed(() => false)

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(
      useTelemetry()?.trackAddApiCreditButtonClicked
    ).not.toHaveBeenCalled()
  })

  it('opens the subscription path without top-up telemetry', async () => {
    setRouteQuery({ topup: '1' })
    useBillingCapabilities().canTopUp = computed(() => false)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledOnce()
    expect(
      useTelemetry()?.trackAddApiCreditButtonClicked
    ).not.toHaveBeenCalled()
  })

  it('denies, strips, and clears together when the user is not eligible', async () => {
    setRouteQuery({ topup: '1', other: 'param' })
    useBillingCapabilities().canTopUp = computed(() => false)

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({
      query: { other: 'param' }
    })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'topup'
    )
  })

  it('restores preserved query and opens the dialog', async () => {
    setRouteQuery({})
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
    setRouteQuery({ topup: '' })

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'topup'
    )
    expect(
      vi.mocked(useBillingCapabilities().initialize)
    ).not.toHaveBeenCalled()
  })

  it('strips but does not open for a non-string param', async () => {
    setRouteQuery({ topup: fromAny<string, unknown>(['array']) })

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })

  it('opens for an unrecognized topup value', async () => {
    setRouteQuery({ topup: 'garbage' })

    const { loadTopUpFromUrl } = useTopUpUrlLoader()
    await loadTopUpFromUrl()

    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledOnce()
  })
})
