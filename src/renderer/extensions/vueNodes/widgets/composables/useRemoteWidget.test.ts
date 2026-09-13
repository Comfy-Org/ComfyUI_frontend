import { QueryClient } from '@tanstack/vue-query'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IWidget } from '@/lib/litegraph/src/litegraph'
import { useRemoteWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useRemoteWidget'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'

const getAppQueryClient = vi.hoisted(() => vi.fn())

vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/remote/queryClient'), () => ({ getAppQueryClient }))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: false }))
vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

describe('useRemoteWidget', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    const apiKeyStore = useApiKeyAuthStore()
    apiKeyStore.apiKeySessionId = 1
    vi.mocked(apiKeyStore.getApiKey).mockReturnValue('api-key')
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

    useApiKeyAuthStore().apiKeySessionId = 2
    expect(remote.getCachedValue()).toEqual([])
  })
})
