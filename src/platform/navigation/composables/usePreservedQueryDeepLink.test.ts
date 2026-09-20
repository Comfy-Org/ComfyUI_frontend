import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

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

async function mountDeepLink(url: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
  })
  await router.push(url)
  await router.isReady()

  let deepLink!: ReturnType<typeof usePreservedQueryDeepLink>
  render(
    defineComponent({
      setup() {
        deepLink = usePreservedQueryDeepLink('invite')
        return () => null
      }
    }),
    { global: { plugins: [router] } }
  )

  let navigations = 0
  router.afterEach(() => {
    navigations++
  })

  return { router, ...deepLink, navigationCount: () => navigations }
}

describe('usePreservedQueryDeepLink', () => {
  beforeEach(() => {
    preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue(undefined)
  })

  describe('hydrateAndRead', () => {
    it('merges a preserved value into the URL and returns it', async () => {
      preservedQueryMocks.mergePreservedQueryIntoQuery.mockReturnValue({
        invite: 'preserved-token'
      })
      const { router, hydrateAndRead } = await mountDeepLink('/')

      const value = await hydrateAndRead()

      expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
      expect(router.currentRoute.value.fullPath).toBe(
        '/?invite=preserved-token'
      )
      expect(value).toBe('preserved-token')
    })

    it('returns the current route value without navigating when nothing is preserved', async () => {
      const { router, hydrateAndRead, navigationCount } =
        await mountDeepLink('/?invite=from-url')

      const value = await hydrateAndRead()

      expect(preservedQueryMocks.hydratePreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
      expect(navigationCount()).toBe(0)
      expect(router.currentRoute.value.fullPath).toBe('/?invite=from-url')
      expect(value).toBe('from-url')
    })
  })

  describe('strip', () => {
    it('removes the key from the URL and clears the preserved namespace', async () => {
      const { router, strip } = await mountDeepLink(
        '/?invite=from-url&other=keep'
      )

      strip()

      await vi.waitFor(() =>
        expect(router.currentRoute.value.fullPath).toBe('/?other=keep')
      )
      expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
    })

    it('clears the preserved namespace without navigating when the key is absent', async () => {
      const { strip, navigationCount } = await mountDeepLink('/?other=keep')

      strip()

      expect(navigationCount()).toBe(0)
      expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
    })

    it('logs a warning when cleaning the URL param fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { router, strip } = await mountDeepLink('/?invite=from-url')
      const replaceError = new Error('navigation guard rejected')
      router.beforeEach(() => {
        throw replaceError
      })

      strip()

      await vi.waitFor(() =>
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('invite'),
          replaceError
        )
      )
      expect(router.currentRoute.value.fullPath).toBe('/?invite=from-url')
      expect(preservedQueryMocks.clearPreservedQuery).toHaveBeenCalledWith(
        'invite'
      )
    })
  })
})
