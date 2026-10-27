import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import { clearPreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { installPreservedQueryTracker } from '@/platform/navigation/preservedQueryTracker'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useSettingsUrlLoader } from '@/platform/settings/composables/useSettingsUrlLoader'

const STORAGE_KEY = 'Comfy.PreservedQuery.settings'

let testRouter: Router

vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

function createAppLikeRouter(): Router {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
  })
  installPreservedQueryTracker(router, [
    {
      namespace: PRESERVED_QUERY_NAMESPACES.SETTINGS,
      keys: ['settings']
    }
  ])
  return router
}

function mountSettingsUrlLoader() {
  let result: ReturnType<typeof useSettingsUrlLoader> | undefined
  const { unmount } = render(
    {
      setup() {
        result = useSettingsUrlLoader()
        return () => null
      }
    },
    { global: { plugins: [testRouter] } }
  )

  if (!result) throw new Error('Failed to mount settings URL loader')
  return { ...result, unmount }
}

describe('useSettingsUrlLoader with real preserved-query boundaries', () => {
  beforeEach(() => {
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.SETTINGS)
    sessionStorage.clear()
    testRouter = createAppLikeRouter()
  })

  it('opens Plans & Credits and cleans the URL when the param survives to mount', async () => {
    await testRouter.push('/?settings=plan-credits&keep=1')

    const { loadSettingsFromUrl } = mountSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(useSettingsDialog().show).toHaveBeenCalledExactlyOnceWith(
      'workspace'
    )
    await vi.waitFor(() =>
      expect(testRouter.currentRoute.value.fullPath).toBe('/?keep=1')
    )
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('restores the deep link through a login redirect that drops the query', async () => {
    await testRouter.push('/?settings=plan-credits')
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify({ settings: 'plan-credits' })
    )

    await testRouter.push('/cloud/login')
    await testRouter.push('/')

    const { loadSettingsFromUrl } = mountSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(useSettingsDialog().show).toHaveBeenCalledExactlyOnceWith(
      'workspace'
    )
    await vi.waitFor(() =>
      expect(testRouter.currentRoute.value.fullPath).toBe('/')
    )
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('consumes the stash so a later mount does not reopen the dialog', async () => {
    await testRouter.push('/?settings=plan-credits')
    await testRouter.push('/')
    const firstMount = mountSettingsUrlLoader()
    await firstMount.loadSettingsFromUrl()
    await vi.waitFor(() =>
      expect(testRouter.currentRoute.value.fullPath).toBe('/')
    )
    firstMount.unmount()
    vi.mocked(useSettingsDialog().show).mockClear()

    await testRouter.push('/')
    await mountSettingsUrlLoader().loadSettingsFromUrl()

    expect(useSettingsDialog().show).not.toHaveBeenCalled()
  })

  it('strips an unrecognized value without opening or leaving a stash behind', async () => {
    await testRouter.push('/?settings=garbage')

    const { loadSettingsFromUrl } = mountSettingsUrlLoader()
    await loadSettingsFromUrl()

    expect(useSettingsDialog().show).not.toHaveBeenCalled()
    await vi.waitFor(() =>
      expect(testRouter.currentRoute.value.fullPath).toBe('/')
    )
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
