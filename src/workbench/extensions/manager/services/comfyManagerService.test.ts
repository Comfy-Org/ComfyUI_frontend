import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useComfyManagerService } from '@/workbench/extensions/manager/services/comfyManagerService'

const mockClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}))

const mockAxios = vi.hoisted(() => ({
  create: vi.fn(() => mockClient),
  isAxiosError: vi.fn(() => false)
}))

const mockApi = vi.hoisted(() => ({
  apiURL: vi.fn((path: string) => `http://localhost:8188${path}`),
  clientId: 'client-1' as string | null,
  initialClientId: 'initial-client'
}))

const mockManagerState = vi.hoisted(() => ({
  isNewManagerUI: { value: true }
}))

const mockIsAbortError = vi.hoisted(() => vi.fn(() => false))

vi.mock('axios', () => ({
  default: mockAxios
}))

vi.mock('uuid', () => ({
  v4: () => 'generated-ui-id'
}))

vi.mock('@/scripts/api', () => ({
  api: mockApi
}))

vi.mock('@/utils/typeGuardUtil', () => ({
  isAbortError: mockIsAbortError
}))

vi.mock('@/workbench/extensions/manager/composables/useManagerState', () => ({
  useManagerState: () => mockManagerState
}))

function axiosError(status: number, message?: string): unknown {
  return {
    response: {
      status,
      data: message ? { message } : undefined
    }
  }
}

describe('useComfyManagerService', () => {
  beforeEach(() => {
    mockClient.get.mockReset()
    mockClient.post.mockReset()
    mockAxios.isAxiosError.mockReset()
    mockAxios.isAxiosError.mockReturnValue(false)
    mockApi.apiURL.mockClear()
    mockManagerState.isNewManagerUI.value = true
    mockApi.clientId = 'client-1'
    mockApi.initialClientId = 'initial-client'
    mockIsAbortError.mockReturnValue(false)
  })

  it('blocks requests when the new manager UI is unavailable', async () => {
    mockManagerState.isNewManagerUI.value = false
    const service = useComfyManagerService()

    const result = await service.listInstalledPacks()

    expect(result).toBeNull()
    expect(service.error.value).toBe(
      'Manager service is not available in current mode'
    )
    expect(mockClient.get).not.toHaveBeenCalled()
  })

  it('fetches installed packs and tracks loading state', async () => {
    mockClient.get.mockResolvedValueOnce({ data: { packs: [] } })
    const service = useComfyManagerService()

    const promise = service.listInstalledPacks()
    expect(service.isLoading.value).toBe(true)
    await expect(promise).resolves.toEqual({ packs: [] })
    expect(service.isLoading.value).toBe(false)
    expect(service.error.value).toBeNull()
    expect(mockClient.get).toHaveBeenCalledWith('customnode/installed', {
      signal: undefined
    })
  })

  it('passes queue status query params only when a client id is provided', async () => {
    mockClient.get
      .mockResolvedValueOnce({ data: { running: true } })
      .mockResolvedValueOnce({ data: { running: false } })
    const service = useComfyManagerService()

    await service.getQueueStatus('client-a')
    await service.getQueueStatus()

    expect(mockClient.get).toHaveBeenNthCalledWith(1, 'manager/queue/status', {
      params: { client_id: 'client-a' },
      signal: undefined
    })
    expect(mockClient.get).toHaveBeenNthCalledWith(2, 'manager/queue/status', {
      params: undefined,
      signal: undefined
    })
  })

  it('returns an empty bulk import result without making a request when no ids or urls are provided', async () => {
    const service = useComfyManagerService()

    await expect(service.getImportFailInfoBulk()).resolves.toEqual({})

    expect(mockClient.post).not.toHaveBeenCalled()
  })

  it('posts bulk import failure requests when ids are provided', async () => {
    mockClient.post.mockResolvedValueOnce({ data: { failed: [] } })
    const service = useComfyManagerService()
    const params = { cnr_ids: ['pack'] } as Parameters<
      typeof service.getImportFailInfoBulk
    >[0]

    await expect(service.getImportFailInfoBulk(params)).resolves.toEqual({
      failed: []
    })
    expect(mockClient.post).toHaveBeenCalledWith(
      'customnode/import_fail_info_bulk',
      params,
      { signal: undefined }
    )
  })

  it('queues install tasks with generated ids and starts the queue', async () => {
    mockClient.post
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null })
    const service = useComfyManagerService()
    const params = { id: 'pack-id' } as Parameters<
      typeof service.installPack
    >[0]

    await expect(service.installPack(params)).resolves.toBeNull()

    expect(mockClient.post).toHaveBeenNthCalledWith(
      1,
      'manager/queue/task',
      {
        kind: 'install',
        params,
        ui_id: 'generated-ui-id',
        client_id: 'client-1'
      },
      { signal: undefined }
    )
    expect(mockClient.post).toHaveBeenNthCalledWith(
      2,
      'manager/queue/start',
      null,
      { signal: undefined }
    )
  })

  it('uses initial client id when queueing and the current client id is absent', async () => {
    mockApi.clientId = null
    mockClient.post
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null })
    const service = useComfyManagerService()
    const params: Parameters<typeof service.updatePack>[0] = {
      node_name: 'pack-id'
    }

    await service.updatePack(params, 'ui-id')

    expect(mockClient.post).toHaveBeenNthCalledWith(
      1,
      'manager/queue/task',
      expect.objectContaining({
        kind: 'update',
        ui_id: 'ui-id',
        client_id: 'initial-client'
      }),
      { signal: undefined }
    )
  })

  it('posts update all requests with query params and starts the queue', async () => {
    mockClient.post
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null })
    const service = useComfyManagerService()

    await service.updateAllPacks({ mode: 'remote' }, 'ui-id')

    expect(mockClient.post).toHaveBeenNthCalledWith(
      1,
      'manager/queue/update_all',
      null,
      {
        params: {
          mode: 'remote',
          client_id: 'client-1',
          ui_id: 'ui-id'
        },
        signal: undefined
      }
    )
  })

  it('maps route-specific axios errors', async () => {
    mockAxios.isAxiosError.mockReturnValueOnce(true)
    mockClient.post.mockRejectedValueOnce(axiosError(403))
    const service = useComfyManagerService()
    const params = { id: 'pack-id' } as Parameters<
      typeof service.installPack
    >[0]

    await expect(service.installPack(params)).resolves.toBeNull()

    expect(service.error.value).toBe(
      'Forbidden: A security error has occurred. Please check the terminal logs'
    )
  })

  it('maps manager connectivity axios errors', async () => {
    mockAxios.isAxiosError.mockReturnValueOnce(true)
    mockClient.get.mockRejectedValueOnce(axiosError(404))
    const service = useComfyManagerService()

    await service.listInstalledPacks()

    expect(service.error.value).toBe('Could not connect to ComfyUI-Manager')
  })

  it('uses response messages from generic axios errors', async () => {
    mockAxios.isAxiosError.mockReturnValueOnce(true)
    mockClient.get.mockRejectedValueOnce(axiosError(500, 'server exploded'))
    const service = useComfyManagerService()

    await service.getTaskHistory()

    expect(service.error.value).toBe('server exploded')
  })

  it('uses thrown error messages for non-axios errors', async () => {
    mockClient.get.mockRejectedValueOnce(new Error('network down'))
    const service = useComfyManagerService()

    await service.getImportFailInfo()

    expect(service.error.value).toBe(
      'Fetching import failure information failed: network down'
    )
  })

  it('does not set an error for aborted requests', async () => {
    mockIsAbortError.mockReturnValueOnce(true)
    mockClient.get.mockRejectedValueOnce(new Error('aborted'))
    const service = useComfyManagerService()

    await service.isLegacyManagerUI()

    expect(service.error.value).toBeNull()
  })
})
