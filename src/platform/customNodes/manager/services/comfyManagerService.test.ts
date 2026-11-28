import type { InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { api } from '@/scripts/api'
import { useManagerState } from '@/platform/customNodes/manager/composables/useManagerState'
import type { components } from '@comfyorg/api-client/generatedManagerTypes'

type InstallPackParams = components['schemas']['InstallPackParams']

vi.mock(import('axios'), { spy: true })
vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/customNodes/manager/composables/useManagerState'))

const requestedUrl = vi.fn<(url: string) => void>()
const requestedBody = vi.fn<(body: unknown) => void>()

async function captureRequestUrl(config: InternalAxiosRequestConfig) {
  requestedUrl(axios.getUri(config))
  requestedBody(config.data)
  return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
}

vi.mocked(axios.create).mockImplementationOnce((config) =>
  axios.create({ ...config, adapter: captureRequestUrl })
)

const { useComfyManagerService } =
  await import('@/platform/customNodes/manager/services/comfyManagerService')

describe('useComfyManagerService', () => {
  it('sends the request to the API base configured after import', async () => {
    api.api_base = '/changed-base'
    vi.mocked(useManagerState()).isNewManagerUI = computed(() => true)

    await useComfyManagerService().listInstalledPacks()

    expect(requestedUrl).toHaveBeenCalledWith(
      '/changed-base/api/v2/customnode/installed'
    )
  })

  it('queues a reinstall task with the params of an install', async () => {
    api.clientId = 'client-1'
    vi.mocked(useManagerState()).isNewManagerUI = computed(() => true)
    const params: InstallPackParams = {
      id: 'comfyui-foo',
      repository: 'https://github.com/test/comfyui-foo',
      channel: 'dev',
      mode: 'cache',
      version: '1.2.0',
      selected_version: '1.2.0'
    }

    await useComfyManagerService().reinstallPack(params, 'task-1')

    expect(requestedUrl).toHaveBeenLastCalledWith('/api/v2/manager/queue/task')
    expect(JSON.parse(String(requestedBody.mock.lastCall?.[0]))).toEqual({
      kind: 'reinstall',
      params,
      ui_id: 'task-1',
      client_id: 'client-1'
    })
  })
})
