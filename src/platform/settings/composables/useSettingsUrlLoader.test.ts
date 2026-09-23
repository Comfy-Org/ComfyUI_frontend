import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import type { LocationQuery, Router } from 'vue-router'
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

let mockRouteQuery: LocationQuery
let mockRouterReplace: MockedFunction<Router['replace']>
const mockShowSettings = vi.mocked(useSettingsDialog().show)

describe('useSettingsUrlLoader', () => {
  beforeEach(() => {
    mockRouteQuery = useRoute().query
    mockRouterReplace = vi.mocked(useRouter().replace)
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  it('does nothing when no settings param present', async () => {
    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(mockShowSettings).not.toHaveBeenCalled()
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('opens the Plans & Credits panel and strips the param', async () => {
    mockRouteQuery.settings = 'plan-credits'

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(mockShowSettings).toHaveBeenCalledExactlyOnceWith('workspace')
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'settings'
    )
  })

  it('preserves unrelated params when stripping', async () => {
    Object.assign(mockRouteQuery, { settings: 'plan-credits', other: 'param' })

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { other: 'param' }
    })
  })

  it('strips but does not open for an unrecognized panel value', async () => {
    mockRouteQuery.settings = 'garbage'

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(mockShowSettings).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'settings'
    )
  })

  it('strips but does not open for an empty param', async () => {
    mockRouteQuery.settings = ''

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(mockShowSettings).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('strips but does not open for a non-string param', async () => {
    mockRouteQuery.settings = fromAny<string, unknown>(['array'])

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(mockShowSettings).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
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
    expect(mockShowSettings).toHaveBeenCalledExactlyOnceWith('workspace')
  })
})
