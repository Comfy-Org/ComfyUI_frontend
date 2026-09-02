import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingsUrlLoader } from './useSettingsUrlLoader'

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

const mockShowSettings = vi.hoisted(() => vi.fn())

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: () => ({
    show: mockShowSettings
  })
}))

describe('useSettingsUrlLoader', () => {
  beforeEach(() => {
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  it('does nothing when no settings param present', () => {
    mockRouteQuery.value = {}

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    loadSettingsFromUrl()

    expect(mockShowSettings).not.toHaveBeenCalled()
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('opens the Plans & Credits panel and strips the param', () => {
    mockRouteQuery.value = { settings: 'plan-credits' }

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    loadSettingsFromUrl()

    expect(mockShowSettings).toHaveBeenCalledExactlyOnceWith('workspace')
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'settings'
    )
  })

  it('preserves unrelated params when stripping', () => {
    mockRouteQuery.value = { settings: 'plan-credits', other: 'param' }

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    loadSettingsFromUrl()

    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { other: 'param' }
    })
  })

  it('strips but does not open for an unrecognized panel value', () => {
    mockRouteQuery.value = { settings: 'garbage' }

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    loadSettingsFromUrl()

    expect(mockShowSettings).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'settings'
    )
  })

  it('strips but does not open for an empty param', () => {
    mockRouteQuery.value = { settings: '' }

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    loadSettingsFromUrl()

    expect(mockShowSettings).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('strips but does not open for a non-string param', () => {
    mockRouteQuery.value = { settings: fromAny<string, unknown>(['array']) }

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    loadSettingsFromUrl()

    expect(mockShowSettings).not.toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
  })

  it('restores preserved query and opens the panel', () => {
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
      settings: 'plan-credits'
    })

    const { loadSettingsFromUrl } = useSettingsUrlLoader()
    loadSettingsFromUrl()

    expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
      'settings'
    )
    expect(mockShowSettings).toHaveBeenCalledExactlyOnceWith('workspace')
  })
})
