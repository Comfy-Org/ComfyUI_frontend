import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useComfyManagerService } from '@/workbench/extensions/manager/services/comfyManagerService'

const mockAxiosInstance = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn()
}))

const managerState = vi.hoisted(() => ({ isNewManagerUI: true }))

vi.mock<unknown>(import('axios'), () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
    isAxiosError: vi.fn()
  }
}))

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    apiURL: (path: string) => path,
    clientId: 'client-1',
    initialClientId: null
  }
}))

vi.mock<unknown>(
  import('@/workbench/extensions/manager/composables/useManagerState'),
  () => ({
    useManagerState: () => ({
      isNewManagerUI: { value: managerState.isNewManagerUI }
    })
  })
)

vi.mock(import('uuid'), () => ({ v4: () => 'generated-uuid' }))

describe('useComfyManagerService', () => {
  let service: ReturnType<typeof useComfyManagerService>

  beforeEach(() => {
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
    const expectQueueNotStarted = () =>
      expect(mockAxiosInstance.post).not.toHaveBeenCalledWith(
        'manager/queue/start',
        null,
        expect.any(Object)
      )

    it.for([
      {
        name: 'installPack',
        kind: 'install',
        call: () =>
          service.installPack({
            id: 'pack',
            version: '1.0.0',
            selected_version: '1.0.0',
            mode: 'remote',
            channel: 'default'
          })
      },
      {
        name: 'uninstallPack',
        kind: 'uninstall',
        call: () =>
          service.uninstallPack({ node_name: 'pack', is_unknown: false })
      },
      {
        name: 'disablePack',
        kind: 'disable',
        call: () =>
          service.disablePack({ node_name: 'pack', is_unknown: false })
      },
      {
        name: 'enablePack',
        kind: 'enable',
        call: () => service.enablePack({ cnr_id: 'pack' })
      },
      {
        name: 'updatePack',
        kind: 'update',
        call: () => service.updatePack({ node_name: 'pack' })
      }
    ])(
      '$name queues a $kind task and leaves starting the queue to the caller',
      async ({ call, kind }) => {
        await call()

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          'manager/queue/task',
          expect.objectContaining({ kind }),
          expect.any(Object)
        )
        expectQueueNotStarted()
      }
    )

    it.for([
      {
        name: 'updateAllPacks',
        url: 'manager/queue/update_all',
        params: { mode: 'remote' },
        call: () => service.updateAllPacks({ mode: 'remote' })
      },
      {
        name: 'updateComfyUI',
        url: 'manager/queue/update_comfyui',
        params: { is_stable: true },
        call: () => service.updateComfyUI({ is_stable: true })
      }
    ])(
      '$name posts to its endpoint and leaves starting the queue to the caller',
      async ({ call, url, params }) => {
        await call()

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          url,
          null,
          expect.objectContaining({ params: expect.objectContaining(params) })
        )
        expectQueueNotStarted()
      }
    )

    it('rebootComfyUI posts to the reboot endpoint', async () => {
      await service.rebootComfyUI()

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'manager/reboot',
        null,
        expect.any(Object)
      )
    })

    it('startQueue posts to the start endpoint and resolves to its response', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: 'started' })

      await expect(service.startQueue()).resolves.toBe('started')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'manager/queue/start',
        null,
        expect.any(Object)
      )
    })

    it('startQueue resolves to null with a security message on 403', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: { status: 403, data: {} }
      })
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      await expect(service.startQueue()).resolves.toBeNull()
      expect(service.error.value).toBe(
        'Forbidden: A security error has occurred. Please check the terminal logs'
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

    it('reports a dedicated message when a network error has no response', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        message: 'Network Error',
        response: undefined
      })
      vi.mocked(axios.isAxiosError).mockReturnValue(true)

      await service.listInstalledPacks()

      expect(service.error.value).toBe(
        'Fetching installed packs failed: Network Error'
      )
    })
  })
})
