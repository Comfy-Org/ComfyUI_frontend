import { createTestingPinia } from '@pinia/testing'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type * as AxiosModule from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createApp, effectScope, h } from 'vue'

import { useRemoteOptions } from '@/platform/remote/composables/useRemoteOptions'
import { remoteOptionKeys } from '@/platform/remote/queryKeys'
import type { RemoteRequestDescriptor } from '@/platform/remote/schema/remoteRequestSchema'

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof AxiosModule>()
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn() }
  }
})

vi.mock('@/platform/workspace/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({ currentWorkspace: null })
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    userId: 'u1',
    getAuthHeader: vi.fn(() => Promise.resolve(null))
  })
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } }
  })
}

function withSetup<T>(setup: () => T): T {
  let result!: T
  const queryClient = createTestQueryClient()
  const app = createApp({
    setup() {
      result = setup()
      return () => h('div')
    }
  })
  app.use(createTestingPinia({ createSpy: vi.fn }))
  app.use(VueQueryPlugin, { queryClient })
  app.mount(document.createElement('div'))
  return result
}

const desc: RemoteRequestDescriptor = {
  client: 'comfyApi',
  route: '/test'
}

describe('useRemoteOptions', () => {
  it('builds a stable, scope-aware query key', () => {
    const key = remoteOptionKeys.byRoute(desc, {
      userId: 'u1',
      workspaceId: 'w1'
    })
    expect(key).toContain('comfyApi')
    expect(key).toContain('/test')
    expect(key).toContain('u1')
    expect(key).toContain('w1')
  })

  it('partitions by route', () => {
    const a = remoteOptionKeys.byRoute(
      { client: 'comfyApi', route: '/a' },
      { userId: 'u1', workspaceId: null }
    )
    const b = remoteOptionKeys.byRoute(
      { client: 'comfyApi', route: '/b' },
      { userId: 'u1', workspaceId: null }
    )
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  it('partitions by workspaceId', () => {
    const a = remoteOptionKeys.byRoute(desc, {
      userId: 'u1',
      workspaceId: 'w1'
    })
    const b = remoteOptionKeys.byRoute(desc, {
      userId: 'u1',
      workspaceId: 'w2'
    })
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })

  it('returns disabled state when descriptor is null', async () => {
    const scope = effectScope()
    let result!: ReturnType<typeof useRemoteOptions>
    scope.run(() => {
      result = withSetup(() =>
        useRemoteOptions({
          descriptor: null
        })
      )
    })
    expect(result.isLoading.value).toBe(false)
    scope.stop()
  })
})
