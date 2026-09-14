import { QueryClient } from '@tanstack/vue-query'
import { fromPartial } from '@total-typescript/shoehorn'
import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IWidget } from '@/lib/litegraph/src/litegraph'
import { useRemoteWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useRemoteWidget'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

const getAppQueryClient = vi.hoisted(() => vi.fn())

vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/remote/queryClient'), () => ({ getAppQueryClient }))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
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

  it('uses captured credentials and ignores a response after the auth scope changes', async () => {
    const node = new LGraphNode('Test')
    vi.spyOn(node, 'addWidget').mockReturnValue(
      fromPartial<IWidget>({ type: 'toggle', options: {} })
    )
    const callback = vi.fn()
    const widget = fromPartial<IWidget>({
      type: 'combo',
      value: undefined,
      callback,
      options: {}
    })
    vi.mocked(useAuthStore().getAuthHeader).mockResolvedValue({
      'X-API-KEY': 'session-a'
    })
    let resolveRequest!: (value: { data: string[] }) => void
    vi.spyOn(axios, 'get').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve
        })
    )
    const remote = useRemoteWidget<string[]>({
      remoteConfig: { route: '/options' },
      defaultValue: [],
      node,
      widget
    })
    const fulfilled = new Promise<void>((resolve) => remote.getValue(resolve))

    await vi.waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith(
        '/options',
        expect.objectContaining({ headers: { 'X-API-KEY': 'session-a' } })
      )
    )
    useApiKeyAuthStore().apiKeySessionId = 2
    resolveRequest({ data: ['stale-option'] })
    await fulfilled

    expect(widget.value).toBeUndefined()
    expect(callback).not.toHaveBeenCalled()
  })
})
