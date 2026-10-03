import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoute, useRouter } from 'vue-router'

import { useSettingsDialog } from './useSettingsDialog'
import { useSettingsUrlLoader } from './useSettingsUrlLoader'

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
vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

describe('useSettingsUrlLoader', () => {
  beforeEach(() => {
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  it('does nothing when no settings param present', async () => {
    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(useSettingsDialog().show).not.toHaveBeenCalled()
    expect(useRouter().replace).not.toHaveBeenCalled()
  })

  it('opens the Plans & Credits panel and strips the param', async () => {
    useRoute().query.settings = 'plan-credits'

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(useSettingsDialog().show).toHaveBeenCalledExactlyOnceWith(
      'workspace'
    )
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'settings'
    )
  })

  it('preserves unrelated params when stripping', async () => {
    useRoute().query.settings = 'plan-credits'
    useRoute().query.other = 'param'

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(useRouter().replace).toHaveBeenCalledWith({
      query: { other: 'param' }
    })
  })

  it('strips but does not open for an unrecognized panel value', async () => {
    useRoute().query.settings = 'garbage'

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(useSettingsDialog().show).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'settings'
    )
  })

  it('strips but does not open for an empty param', async () => {
    useRoute().query.settings = ''

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(useSettingsDialog().show).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })

  it('strips but does not open for a non-string param', async () => {
    useRoute().query.settings = fromAny<string, unknown>(['array'])

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(useSettingsDialog().show).not.toHaveBeenCalled()
    expect(useRouter().replace).toHaveBeenCalledWith({ query: {} })
  })

  it('restores preserved query and opens the panel', async () => {
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
      settings: 'plan-credits'
    })

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
      'settings'
    )
    expect(useSettingsDialog().show).toHaveBeenCalledExactlyOnceWith(
      'workspace'
    )
  })
})
