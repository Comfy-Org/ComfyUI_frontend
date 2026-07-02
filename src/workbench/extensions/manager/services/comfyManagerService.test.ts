import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useComfyManagerService } from '@/workbench/extensions/manager/services/comfyManagerService'

const mockAxiosInstance = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}))

const managerState = vi.hoisted(() => ({ isNewManagerUI: true }))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
    isAxiosError: vi.fn()
  }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (path: string) => path,
    clientId: 'client-1',
    initialClientId: null
  }
}))

vi.mock('@/workbench/extensions/manager/composables/useManagerState', () => ({
  useManagerState: () => ({
    isNewManagerUI: { value: managerState.isNewManagerUI }
  })
}))

vi.mock('uuid', () => ({ v4: () => 'generated-uuid' }))

describe('useComfyManagerService', () => {
  let service: ReturnType<typeof useComfyManagerService>

  beforeEach(() => {
    vi.clearAllMocks()
    managerState.isNewManagerUI = true
    mockAxiosInstance.get.mockResolvedValue({ data: {} })
    mockAxiosInstance.post.mockResolvedValue({ data: null })
    service = useComfyManagerService()
  })

  it('initializes with idle state', () => {
    expect(service.isLoading.value).toBe(false)
    expect(service.error.value).toBeNull()
  })

  describe('availability gate', () => {
    it('short-circuits requests when Manager is not in NEW_UI mode', async () => {
      managerState.isNewManagerUI = false

      const result = await service.listInstalledPacks()

      expect(result).toBeNull()
      expect(mockAxiosInstance.get).not.toHaveBeenCalled()
      expect(service.error.value).toBe(
        'Manager service is not available in current mode'
      )
    })
  })

  describe('read requests', () => {
    it('getQueueStatus forwards the client_id param', async () => {
      await service.getQueueStatus('abc')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'manager/queue/status',
        expect.objectContaining({ params: { client_id: 'abc' } })
      )
    })

    it('listInstalledPacks hits the installed endpoint', async () => {
      await service.listInstalledPacks()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'customnode/installed',
        expect.any(Object)
      )
    })

    it('getImportFailInfo hits the import-fail endpoint', async () => {
      await service.getImportFailInfo()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'customnode/import_fail_info',
        expect.any(Object)
      )
    })

    it('getImportFailInfoBulk returns empty without identifiers', async () => {
      const result = await service.getImportFailInfoBulk({})

      expect(result).toEqual({})
      expect(mockAxiosInstance.post).not.toHaveBeenCalled()
    })

    it('getImportFailInfoBulk posts when identifiers are present', async () => {
      await service.getImportFailInfoBulk({ cnr_ids: ['a'] })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'customnode/import_fail_info_bulk',
        { cnr_ids: ['a'] },
        expect.any(Object)
      )
    })

    it('isLegacyManagerUI hits the legacy-ui endpoint', async () => {
      await service.isLegacyManagerUI()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'manager/is_legacy_manager_ui',
        expect.any(Object)
      )
    })

    it('getTaskHistory forwards options as params', async () => {
      await service.getTaskHistory({ max_items: 5 })

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'manager/queue/history',
        expect.objectContaining({ params: { max_items: 5 } })
      )
    })
  })

  describe('queue operations', () => {
    it('installPack queues an install task then starts the queue', async () => {
      await service.installPack({
        id: 'pack',
        version: '1.0.0',
        selected_version: '1.0.0',
        mode: 'remote',
        channel: 'default'
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'manager/queue/task',
        expect.objectContaining({ kind: 'install' }),
        expect.any(Object)
      )
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'manager/queue/start',
        null,
        expect.any(Object)
      )
    })

    it('uninstallPack queues an uninstall task', async () => {
      await service.uninstallPack({ node_name: 'pack', is_unknown: false })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'manager/queue/task',
        expect.objectContaining({ kind: 'uninstall' }),
        expect.any(Object)
      )
    })

    it('updateAllPacks posts to the update_all endpoint', async () => {
      await service.updateAllPacks({ mode: 'remote' })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'manager/queue/update_all',
        null,
        expect.objectContaining({
          params: expect.objectContaining({ mode: 'remote' })
        })
      )
    })

    it('updateComfyUI posts to the update_comfyui endpoint', async () => {
      await service.updateComfyUI({ is_stable: true })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'manager/queue/update_comfyui',
        null,
        expect.objectContaining({
          params: expect.objectContaining({ is_stable: true })
        })
      )
    })

    it('rebootComfyUI posts to the reboot endpoint', async () => {
      await service.rebootComfyUI()

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'manager/reboot',
        null,
        expect.any(Object)
      )
    })

    it('startQueue posts to the start endpoint', async () => {
      await service.startQueue()

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'manager/queue/start',
        null,
        expect.any(Object)
      )
    })
  })

  describe('error mapping', () => {
    it('prefers a route-specific message for a matching status', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: { status: 403, data: {} }
      })
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      await service.rebootComfyUI()

      expect(service.error.value).toBe(
        'Forbidden: Rebooting ComfyUI requires security_level of middle or below'
      )
    })

    it('maps 404 to a connection message', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 404, data: {} }
      })
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      await service.listInstalledPacks()

      expect(service.error.value).toBe('Could not connect to ComfyUI-Manager')
    })

    it('falls back to the response message for other statuses', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 500, data: { message: 'server exploded' } }
      })
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      await service.listInstalledPacks()

      expect(service.error.value).toBe('server exploded')
    })

    it('handles non-axios errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('boom'))
      vi.mocked(axios.isAxiosError).mockReturnValue(false)

      await service.listInstalledPacks()

      expect(service.error.value).toBe('Fetching installed packs failed: boom')
    })
  })
})
