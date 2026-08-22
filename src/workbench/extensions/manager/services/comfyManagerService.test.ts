import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const axiosMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  isAxiosError: vi.fn(() => false)
}))

vi.mock('axios', () => ({
  default: {
    create: () => ({ get: axiosMocks.get, post: axiosMocks.post }),
    isAxiosError: axiosMocks.isAxiosError
  }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (path: string) => path,
    clientId: 'test-client',
    initialClientId: 'initial-client'
  }
}))

vi.mock('@/workbench/extensions/manager/composables/useManagerState', () => ({
  useManagerState: () => ({ isNewManagerUI: ref(true) })
}))

import { useComfyManagerService } from './comfyManagerService'

const installParams = {
  id: 'comfyui-kjnodes',
  repository: 'https://example.com/comfyui-kjnodes.git',
  channel: 'dev' as const,
  mode: 'cache' as const,
  selected_version: 'latest' as const,
  version: 'latest' as const
}

describe('comfyManagerService install admission', () => {
  beforeEach(() => {
    axiosMocks.post.mockReset()
  })

  it('propagates a queue admission failure to its caller', async () => {
    const error = new Error('queue unavailable')
    axiosMocks.post.mockRejectedValueOnce(error)

    await expect(
      useComfyManagerService().installPack(installParams, 'task-id')
    ).rejects.toBe(error)
  })

  it('propagates an aborted admission without converting it to success', async () => {
    const error = new DOMException('Aborted', 'AbortError')
    axiosMocks.post.mockRejectedValueOnce(error)

    await expect(
      useComfyManagerService().installPack(installParams, 'task-id')
    ).rejects.toBe(error)
  })
})
