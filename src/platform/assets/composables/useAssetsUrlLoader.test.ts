import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import { useAssetsUrlLoader } from './useAssetsUrlLoader'

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

describe('useAssetsUrlLoader', () => {
  let sidebar: ReturnType<typeof useSidebarTabStore>

  beforeEach(() => {
    mockRouteQuery.value = {}
    sidebar = useSidebarTabStore()
    sidebar.activeSidebarTabId = null
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  it('leaves the workspace alone when no assets param is present', () => {
    useAssetsUrlLoader().loadAssetsFromUrl()

    expect(sidebar.activeSidebarTabId).toBeNull()
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('opens the Assets panel and strips the param', () => {
    mockRouteQuery.value = { assets: '1' }

    useAssetsUrlLoader().loadAssetsFromUrl()

    expect(sidebar.activeSidebarTabId).toBe('assets')
    expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
      'assets'
    )
  })

  it('leaves the panel open for a visitor who already had it open', () => {
    sidebar.activeSidebarTabId = 'assets'
    mockRouteQuery.value = { assets: '1' }

    useAssetsUrlLoader().loadAssetsFromUrl()

    expect(
      sidebar.activeSidebarTabId,
      'following the link must land on the assets panel, not toggle it shut'
    ).toBe('assets')
  })

  it('preserves unrelated params when stripping', () => {
    mockRouteQuery.value = { assets: '1', other: 'param' }

    useAssetsUrlLoader().loadAssetsFromUrl()

    expect(mockRouterReplace).toHaveBeenCalledWith({
      query: { other: 'param' }
    })
  })

  it.for([['garbage'], [''], [fromAny<string, unknown>(['array'])]] as const)(
    'strips %j without opening a panel',
    ([assets]) => {
      mockRouteQuery.value = { assets }

      useAssetsUrlLoader().loadAssetsFromUrl()

      expect(sidebar.activeSidebarTabId).toBeNull()
      expect(mockRouterReplace).toHaveBeenCalledWith({ query: {} })
    }
  )

  it('restores the preserved query across a sign-in and opens the panel', () => {
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
      assets: '1'
    })

    useAssetsUrlLoader().loadAssetsFromUrl()

    expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
      'assets'
    )
    expect(
      sidebar.activeSidebarTabId,
      'a signed-out visitor following the link must still land on their assets'
    ).toBe('assets')
  })
})
