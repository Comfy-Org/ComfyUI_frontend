import { QueryClient } from '@tanstack/vue-query'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IWidget } from '@/lib/litegraph/src/litegraph'
import { useRemoteWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useRemoteWidget'

const authState = vi.hoisted(() => ({ apiKeySessionId: 1 }))
const getAppQueryClient = vi.hoisted(() => vi.fn())

vi.mock('@/platform/remote/queryClient', () => ({ getAppQueryClient }))
vi.mock('@/platform/distribution/types', () => ({ isCloud: false }))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ userId: null })
}))
vi.mock('@/stores/apiKeyAuthStore', () => ({
  useApiKeyAuthStore: () => ({
    getApiKey: () => 'api-key',
    get apiKeySessionId() {
      return authState.apiKeySessionId
    }
  })
}))
vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

describe('useRemoteWidget', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    authState.apiKeySessionId = 1
    queryClient = new QueryClient()
    getAppQueryClient.mockReturnValue(queryClient)
  })

  it('does not return cached data from a previous API-key session', () => {
    const node = new LGraphNode('Test')
    vi.spyOn(node, 'addWidget').mockReturnValue(
      fromPartial<IWidget>({
        type: 'toggle',
        name: 'Auto-refresh after generation',
        value: false,
        options: {}
      })
    )
    const widget = fromPartial<IWidget>({
      type: 'combo',
      name: 'remote',
      value: undefined,
      options: {}
    })
    const remote = useRemoteWidget<string[]>({
      remoteConfig: { route: '/options' },
      defaultValue: [],
      node,
      widget
    })

    queryClient.setQueryData(remote.getQueryKey(), ['session-a'])
    expect(remote.getCachedValue()).toEqual(['session-a'])

    authState.apiKeySessionId = 2
    expect(remote.getCachedValue()).toEqual([])
  })
})
