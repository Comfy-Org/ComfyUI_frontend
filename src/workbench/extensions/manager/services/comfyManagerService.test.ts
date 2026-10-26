import type { InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { api } from '@/scripts/api'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'

vi.mock(import('axios'), { spy: true })
vi.mock(import('@/scripts/api'))
vi.mock(import('@/workbench/extensions/manager/composables/useManagerState'))

const requestedUrl = vi.fn<(url: string) => void>()

async function captureRequestUrl(config: InternalAxiosRequestConfig) {
  requestedUrl(axios.getUri(config))
  return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
}

vi.mocked(axios.create).mockImplementationOnce((config) =>
  axios.create({ ...config, adapter: captureRequestUrl })
)

const { useComfyManagerService } =
  await import('@/workbench/extensions/manager/services/comfyManagerService')

describe('useComfyManagerService', () => {
  it('sends the request to the API base configured after import', async () => {
    api.api_base = '/changed-base'
    vi.mocked(useManagerState()).isNewManagerUI = computed(() => true)

    await useComfyManagerService().listInstalledPacks()

    expect(requestedUrl).toHaveBeenCalledWith(
      '/changed-base/api/v2/customnode/installed'
    )
  })
})
