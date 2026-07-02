import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePreservedQueryDeepLink } from './usePreservedQueryDeepLink'

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

describe('usePreservedQueryDeepLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteQuery.value = {}
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('hydrateAndRead', () => {
    it('merges a preserved value into the URL and returns it', async () => {
      preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
        invite: 'preserved-token'
      })

      const { hydrateAndRead } = usePreservedQueryDeepLink('invite', 'invite')
      const value = await hydrateAndRead()

      expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
      expect(mockRouterReplace).toHaveBeenCalledWith({
        query: { invite: 'preserved-token' }
      })
      expect(value).toBe('preserved-token')
    })

    it('returns the current route value without replacing when nothing is preserved', async () => {
      mockRouteQuery.value = { invite: 'from-url' }

      const { hydrateAndRead } = usePreservedQueryDeepLink('invite', 'invite')
      const value = await hydrateAndRead()

      expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
      expect(mockRouterReplace).not.toHaveBeenCalled()
      expect(value).toBe('from-url')
    })
  })

  describe('strip', () => {
    it('removes the key from the URL and clears the preserved namespace', () => {
      mockRouteQuery.value = { invite: 'from-url', other: 'keep' }

      const { strip } = usePreservedQueryDeepLink('invite', 'invite')
      strip()

      expect(mockRouterReplace).toHaveBeenCalledWith({
        query: { other: 'keep' }
      })
      expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
    })
  })
})
