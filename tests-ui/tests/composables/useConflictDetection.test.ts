import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useConflictDetection } from '@/composables/useConflictDetection'
import type { InstalledPacksResponse } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

// Mock dependencies
vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    interrupt: vi.fn(),
    init: vi.fn(),
    internalURL: vi.fn(),
    apiURL: vi.fn(),
    fileURL: vi.fn(),
    dispatchCustomEvent: vi.fn(),
    dispatchEvent: vi.fn(),
    getExtensions: vi.fn(),
    freeMemory: vi.fn()
  }
}))

vi.mock('@/services/comfyManagerService', () => ({
  useComfyManagerService: vi.fn()
}))

vi.mock('@/services/comfyRegistryService', () => ({
  useComfyRegistryService: vi.fn()
}))

vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: vi.fn()
}))

vi.mock('@/config', () => ({
  default: {
    app_version: '1.24.0-1'
  }
}))

vi.mock('@/composables/useConflictAcknowledgment', () => ({
  useConflictAcknowledgment: vi.fn()
}))

vi.mock('@/composables/nodePack/useInstalledPacks', () => ({
  useInstalledPacks: vi.fn(() => ({
    installedPacks: { value: [] },
    refreshInstalledPacks: vi.fn(),
    startFetchInstalled: vi.fn()
  }))
}))

vi.mock('@/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn(() => ({
    isPackInstalled: vi.fn(),
    installedPacks: { value: [] }
  }))
}))

vi.mock('@/stores/conflictDetectionStore', () => ({
  useConflictDetectionStore: vi.fn(() => ({
    conflictResults: { value: [] },
    updateConflictResults: vi.fn(),
    clearConflicts: vi.fn(),
    setConflictResults: vi.fn()
  }))
}))

describe.skip('useConflictDetection with Registry Store', () => {
  let pinia: ReturnType<typeof createPinia>

  const mockComfyManagerService = {
    listInstalledPacks: vi.fn(),
    getImportFailInfo: vi.fn()
  }

  const mockRegistryService = {
    getPackByVersion: vi.fn()
  }

  const mockAcknowledgment = {
    checkComfyUIVersionChange: vi.fn(),
    shouldShowConflictModal: { value: true },
    shouldShowRedDot: { value: true },
    acknowledgedPackageIds: { value: [] },
    dismissConflictModal: vi.fn(),
    dismissRedDotNotification: vi.fn(),
    acknowledgeConflict: vi.fn()
  }

  const mockSystemStatsStore = {
    fetchSystemStats: vi.fn(),
    systemStats: {
      system: {
        comfyui_version: '0.3.41',
        os: 'Darwin'
      },
      devices: [
        {
          name: 'Apple M1 Pro',
          type: 'mps',
          vram_total: 17179869184
        }
      ]
    } as any
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)

    // Reset mock system stats to default state
    mockSystemStatsStore.systemStats = {
      system: {
        comfyui_version: '0.3.41',
        os: 'Darwin'
      },
      devices: [
        {
          name: 'Apple M1 Pro',
          type: 'mps',
          vram_total: 17179869184
        }
      ]
    } as any

    // Reset mock functions
    mockSystemStatsStore.fetchSystemStats.mockResolvedValue(undefined)
    mockComfyManagerService.listInstalledPacks.mockReset()
    mockComfyManagerService.getImportFailInfo.mockReset()
    mockRegistryService.getPackByVersion.mockReset()

    // Mock useComfyManagerService
    const { useComfyManagerService } = await import(
      '@/services/comfyManagerService'
    )
    vi.mocked(useComfyManagerService).mockReturnValue(
      mockComfyManagerService as any
    )

    // Mock useComfyRegistryService
    const { useComfyRegistryService } = await import(
      '@/services/comfyRegistryService'
    )
    vi.mocked(useComfyRegistryService).mockReturnValue(
      mockRegistryService as any
    )

    // Mock useSystemStatsStore
    const { useSystemStatsStore } = await import('@/stores/systemStatsStore')
    vi.mocked(useSystemStatsStore).mockReturnValue(mockSystemStatsStore as any)

    // Mock useConflictAcknowledgment
    const { useConflictAcknowledgment } = await import(
      '@/composables/useConflictAcknowledgment'
    )
    vi.mocked(useConflictAcknowledgment).mockReturnValue(
      mockAcknowledgment as any
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('system environment detection', () => {
    it('should collect system environment information successfully', async () => {
      const { detectSystemEnvironment } = useConflictDetection()
      const environment = await detectSystemEnvironment()

      expect(environment.comfyui_version).toBe('0.3.41')
      expect(environment.frontend_version).toBe('1.24.0-1')
      expect(environment.available_accelerators).toContain('Metal')
      expect(environment.available_accelerators).toContain('CPU')
      expect(environment.primary_accelerator).toBe('Metal')
    })

    it('should return fallback environment information when systemStatsStore fails', async () => {
      // Mock systemStatsStore failure
      mockSystemStatsStore.fetchSystemStats.mockRejectedValue(
        new Error('Store failure')
      )
      mockSystemStatsStore.systemStats = null

      const { detectSystemEnvironment } = useConflictDetection()
      const environment = await detectSystemEnvironment()

      expect(environment.comfyui_version).toBe('unknown')
      expect(environment.frontend_version).toBe('1.24.0-1')
      expect(environment.available_accelerators).toEqual(['CPU'])
    })
  })

  describe('package requirements detection with Registry Store', () => {
    it('should fetch and combine local + Registry data successfully', async () => {
      // Mock installed packages
      const mockInstalledPacks: InstalledPacksResponse = {
        'ComfyUI-Manager': {
          ver: 'cb0fa5829d5378e5dddb8e8515b30a3ff20e1471',
          cnr_id: '',
          aux_id: 'viva-jinyi/ComfyUI-Manager',
          enabled: true
        },
        'ComfyUI-TestNode': {
          ver: '1.0.0',
          cnr_id: 'test-node',
          aux_id: null,
          enabled: false
        }
      }

      // Mock Registry data
      const mockRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'ComfyUI-Manager',
          name: 'ComfyUI Manager',
          supported_os: ['Windows', 'Linux', 'macOS'],
          supported_accelerators: ['CUDA', 'Metal', 'CPU'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node'],
        {
          id: 'ComfyUI-TestNode',
          name: 'Test Node',
          supported_os: ['Windows', 'Linux'],
          supported_accelerators: ['CUDA'],
          supported_comfyui_version: '>=0.2.0',
          status: 'NodeStatusBanned'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )

      // Mock Registry Service individual calls
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string) => {
          const packageData = mockRegistryPacks.find(
            (p) => p.id === packageName
          )
          if (packageData) {
            return Promise.resolve({
              ...packageData,
              supported_comfyui_version: packageData.supported_comfyui_version,
              supported_os: packageData.supported_os,
              supported_accelerators: packageData.supported_accelerators,
              status: packageData.status
            })
          }
          return Promise.resolve(null)
        }
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBeGreaterThanOrEqual(1)
      expect(result.results.length).toBeGreaterThanOrEqual(1)

      // Verify individual calls were made
      expect(mockRegistryService.getPackByVersion).toHaveBeenCalledWith(
        'ComfyUI-Manager',
        'cb0fa5829d5378e5dddb8e8515b30a3ff20e1471',
        expect.anything()
      )
      expect(mockRegistryService.getPackByVersion).toHaveBeenCalledWith(
        'ComfyUI-TestNode',
        '1.0.0',
        expect.anything()
      )

      // Check that at least one package was processed
      expect(result.results.length).toBeGreaterThan(0)

      // If we have results, check their structure
      if (result.results.length > 0) {
        const firstResult = result.results[0]
        expect(firstResult).toHaveProperty('package_id')
        expect(firstResult).toHaveProperty('conflicts')
        expect(firstResult).toHaveProperty('is_compatible')
      }
    })

    it('should handle Registry Store failures gracefully', async () => {
      // Mock installed packages
      const mockInstalledPacks: InstalledPacksResponse = {
        'Unknown-Package': {
          ver: '1.0.0',
          cnr_id: 'unknown',
          aux_id: null,
          enabled: true
        }
      }

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )

      // Mock Registry Service returning null (no packages found)
      mockRegistryService.getPackByVersion.mockResolvedValue(null)

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(1)
      expect(result.results).toHaveLength(1)

      // Should have warning about missing Registry data
      const unknownPackage = result.results[0]
      expect(unknownPackage.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'pending',
            current_value: 'no_registry_data',
            required_value: 'registry_data_available'
          })
        ])
      )
    })

    it('should return empty array when local package information cannot be retrieved', async () => {
      mockComfyManagerService.listInstalledPacks.mockResolvedValue(null)

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(0)
      expect(result.results).toHaveLength(0)
    })
  })

  describe('conflict detection logic with Registry Store', () => {
    it('should detect no conflicts for fully compatible packages', async () => {
      // Mock compatible package
      const mockInstalledPacks: InstalledPacksResponse = {
        CompatibleNode: {
          ver: '1.0.0',
          cnr_id: 'compatible-node',
          aux_id: null,
          enabled: true
        }
      }

      const mockCompatibleRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'CompatibleNode',
          name: 'Compatible Node',
          supported_os: ['Windows', 'Linux', 'macOS'],
          supported_accelerators: ['Metal', 'CUDA', 'CPU'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      // Mock Registry Service for compatible package
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string) => {
          const packageData = mockCompatibleRegistryPacks.find(
            (p) => p.id === packageName
          )
          return Promise.resolve(packageData || null)
        }
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.conflicted_packages).toBe(0)
      expect(result.summary.compatible_packages).toBe(1)
      expect(result.results[0].conflicts).toHaveLength(0)
    })

    it('should detect OS incompatibility conflicts', async () => {
      // Mock OS-incompatible package
      const mockInstalledPacks: InstalledPacksResponse = {
        WindowsOnlyNode: {
          ver: '1.0.0',
          cnr_id: 'windows-only',
          aux_id: null,
          enabled: true
        }
      }

      const mockWindowsOnlyRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'WindowsOnlyNode',
          name: 'Windows Only Node',
          supported_os: ['Windows'],
          supported_accelerators: ['Metal', 'CUDA', 'CPU'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string) => {
          const packageData = mockWindowsOnlyRegistryPacks.find(
            (p: any) => p.id === packageName
          )
          return Promise.resolve(packageData || null)
        }
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.conflicted_packages).toBe(1)

      const windowsNode = result.results[0]
      expect(windowsNode.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'os',
            current_value: 'macOS',
            required_value: expect.stringContaining('Windows')
          })
        ])
      )
    })

    it('should detect accelerator incompatibility conflicts', async () => {
      // Mock CUDA-only package
      const mockInstalledPacks: InstalledPacksResponse = {
        CudaOnlyNode: {
          ver: '1.0.0',
          cnr_id: 'cuda-only',
          aux_id: null,
          enabled: true
        }
      }

      const mockCudaOnlyRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'CudaOnlyNode',
          name: 'CUDA Only Node',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['CUDA'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string) => {
          const packageData = mockCudaOnlyRegistryPacks.find(
            (p: any) => p.id === packageName
          )
          return Promise.resolve(packageData || null)
        }
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.conflicted_packages).toBe(1)

      const cudaNode = result.results[0]
      expect(cudaNode.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'accelerator',
            current_value: expect.any(String),
            required_value: expect.stringContaining('CUDA')
          })
        ])
      )
    })

    it('should treat Registry-banned packages as conflicts', async () => {
      // Mock Registry-banned package
      const mockInstalledPacks: InstalledPacksResponse = {
        BannedNode: {
          ver: '1.0.0',
          cnr_id: 'banned-node',
          aux_id: null,
          enabled: true
        }
      }

      const mockBannedRegistryPacks: components['schemas']['NodeVersion'][] = [
        {
          id: 'BannedNode',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['Metal', 'CUDA', 'CPU'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeVersionStatusBanned'
        } as components['schemas']['NodeVersion']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string) => {
          const packageData = mockBannedRegistryPacks.find(
            (p: any) => p.id === packageName
          )
          return Promise.resolve(packageData || null)
        }
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.banned_packages).toBe(1)

      const bannedNode = result.results[0]
      expect(bannedNode.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'banned',
            current_value: 'installed',
            required_value: 'not_banned'
          })
        ])
      )
      // Banned nodes should have 'banned' conflict type
      expect(bannedNode.conflicts.some((c) => c.type === 'banned')).toBe(true)
    })

    it('should treat locally disabled packages as banned', async () => {
      // Mock locally disabled package
      const mockInstalledPacks: InstalledPacksResponse = {
        DisabledNode: {
          ver: '1.0.0',
          cnr_id: 'disabled-node',
          aux_id: null,
          enabled: false
        }
      }

      const mockActiveRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'DisabledNode',
          name: 'Disabled Node',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['Metal', 'CUDA', 'CPU'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string) => {
          const packageData = mockActiveRegistryPacks.find(
            (p: any) => p.id === packageName
          )
          return Promise.resolve(packageData || null)
        }
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.banned_packages).toBe(1)

      const disabledNode = result.results[0]
      expect(disabledNode.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'banned',
            current_value: 'installed',
            required_value: 'not_banned'
          })
        ])
      )
      // Disabled nodes should have 'banned' conflict type
      expect(disabledNode.conflicts.some((c) => c.type === 'banned')).toBe(true)
    })
  })

  describe('computed properties with Registry Store', () => {
    it('should return true for hasConflicts when Registry conflicts exist', async () => {
      // Mock package with OS incompatibility
      const mockInstalledPacks: InstalledPacksResponse = {
        ConflictedNode: {
          ver: '1.0.0',
          cnr_id: 'conflicted-node',
          aux_id: null,
          enabled: true
        }
      }

      const mockConflictedRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'ConflictedNode',
          name: 'Conflicted Node',
          supported_os: ['Windows'],
          supported_accelerators: ['Metal', 'CUDA', 'CPU'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string) => {
          const packageData = mockConflictedRegistryPacks.find(
            (p: any) => p.id === packageName
          )
          return Promise.resolve(packageData || null)
        }
      )

      const { hasConflicts, performConflictDetection } = useConflictDetection()

      // Initial value should be false
      expect(hasConflicts.value).toBe(false)

      // Execute conflict detection
      await performConflictDetection()
      await nextTick()

      // Should be true when conflicts are detected
      expect(hasConflicts.value).toBe(true)
    })

    it('should return packages with conflicts', async () => {
      // Mock package with conflicts
      const mockInstalledPacks: InstalledPacksResponse = {
        ErrorNode: {
          ver: '1.0.0',
          cnr_id: 'error-node',
          aux_id: null,
          enabled: true
        }
      }

      const mockErrorRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'ErrorNode',
          name: 'Error Node',
          supported_os: ['Windows'],
          supported_accelerators: ['CUDA'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string) => {
          const packageData = mockErrorRegistryPacks.find(
            (p: any) => p.id === packageName
          )
          return Promise.resolve(packageData || null)
        }
      )

      const { conflictedPackages, performConflictDetection } =
        useConflictDetection()

      await performConflictDetection()
      await nextTick()

      expect(conflictedPackages.value.length).toBeGreaterThan(0)
      expect(
        conflictedPackages.value.every((result) => result.has_conflict === true)
      ).toBe(true)
    })

    it('should return only banned packages for bannedPackages', async () => {
      // Mock one banned and one normal package
      const mockInstalledPacks: InstalledPacksResponse = {
        BannedNode: {
          ver: '1.0.0',
          cnr_id: 'banned-node',
          aux_id: null,
          enabled: false
        },
        NormalNode: {
          ver: '1.0.0',
          cnr_id: 'normal-node',
          aux_id: null,
          enabled: true
        }
      }

      const mockRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'BannedNode',
          name: 'Banned Node',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['Metal', 'CUDA', 'CPU'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node'],
        {
          id: 'NormalNode',
          name: 'Normal Node',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['Metal', 'CUDA', 'CPU'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string) => {
          const packageData = mockRegistryPacks.find(
            (p: any) => p.id === packageName
          )
          return Promise.resolve(packageData || null)
        }
      )

      const { bannedPackages, performConflictDetection } =
        useConflictDetection()

      await performConflictDetection()
      await nextTick()

      expect(bannedPackages.value).toHaveLength(1)
      expect(bannedPackages.value[0].package_id).toBe('BannedNode')
    })
  })

  describe('error resilience with Registry Store', () => {
    it('should continue execution even when system environment detection fails', async () => {
      // Mock system stats store failure
      mockSystemStatsStore.fetchSystemStats.mockRejectedValue(
        new Error('Store error')
      )
      mockSystemStatsStore.systemStats = null
      mockComfyManagerService.listInstalledPacks.mockResolvedValue({})
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string) => {
          const packageData = [].find((p: any) => p.id === packageName)
          return Promise.resolve(packageData || null)
        }
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.detected_system_environment?.comfyui_version).toBe(
        'unknown'
      )
    })

    it('should continue system operation even when local package information fails', async () => {
      // Mock local package service failure
      mockComfyManagerService.listInstalledPacks.mockRejectedValue(
        new Error('Service error')
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(0)
    })

    it('should handle Registry Store partial data gracefully', async () => {
      // Mock successful local data but partial Registry data
      const mockInstalledPacks: InstalledPacksResponse = {
        'Package-A': {
          ver: '1.0.0',
          cnr_id: 'a',
          aux_id: null,
          enabled: true
        },
        'Package-B': {
          ver: '2.0.0',
          cnr_id: 'b',
          aux_id: null,
          enabled: true
        }
      }

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )

      // Only first package found in Registry / Registry에서 첫 번째 패키지만 찾음
      const mockPartialRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'Package-A',
          name: 'Package A',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['Metal', 'CUDA', 'CPU'],
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
        // Package-B is missing from Registry results
      ]

      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string) => {
          const packageData = mockPartialRegistryPacks.find(
            (p: any) => p.id === packageName
          )
          return Promise.resolve(packageData || null)
        }
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBeGreaterThanOrEqual(1)

      // Check that packages were processed
      expect(result.results.length).toBeGreaterThan(0)

      // If packages exist, verify they have proper structure
      if (result.results.length > 0) {
        for (const pkg of result.results) {
          expect(pkg).toHaveProperty('package_id')
          expect(pkg).toHaveProperty('conflicts')
          expect(Array.isArray(pkg.conflicts)).toBe(true)
        }
      }
    })

    it('should handle complete system failure gracefully', async () => {
      // Mock all stores/services failing
      mockSystemStatsStore.fetchSystemStats.mockRejectedValue(
        new Error('Critical error')
      )
      mockSystemStatsStore.systemStats = null
      mockComfyManagerService.listInstalledPacks.mockRejectedValue(
        new Error('Critical error')
      )
      mockRegistryService.getPackByVersion.mockRejectedValue(
        new Error('Critical error')
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true) // Error resilience maintains success
      expect(result.summary.total_packages).toBe(0)
    })
  })

  describe('acknowledgment integration', () => {
    it('should check ComfyUI version change during conflict detection', async () => {
      mockComfyManagerService.listInstalledPacks.mockResolvedValue({
        TestNode: {
          ver: '1.0.0',
          cnr_id: 'test-node',
          aux_id: null,
          enabled: true
        }
      })

      mockRegistryService.getPackByVersion.mockResolvedValue({
        id: 'TestNode',
        supported_os: ['Windows'],
        supported_accelerators: ['CUDA'],
        supported_comfyui_version: '>=0.3.0',
        status: 'NodeVersionStatusActive'
      })

      const { performConflictDetection } = useConflictDetection()
      await performConflictDetection()

      expect(mockAcknowledgment.checkComfyUIVersionChange).toHaveBeenCalledWith(
        '0.3.41'
      )
    })

    it('should expose conflict modal display method', () => {
      const { shouldShowConflictModalAfterUpdate } = useConflictDetection()

      expect(shouldShowConflictModalAfterUpdate).toBeDefined()
    })

    it('should determine conflict modal display after update correctly', async () => {
      const { shouldShowConflictModalAfterUpdate } = useConflictDetection()

      // With no conflicts initially, should return false
      const result = await shouldShowConflictModalAfterUpdate()
      expect(result).toBe(false) // No conflicts initially
    })

    it('should show conflict modal after update when conflicts exist', async () => {
      // Mock package with conflicts
      const mockInstalledPacks: InstalledPacksResponse = {
        ConflictedNode: {
          ver: '1.0.0',
          cnr_id: 'conflicted-node',
          aux_id: null,
          enabled: true
        }
      }

      const mockConflictedRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'ConflictedNode',
          name: 'Conflicted Node',
          supported_os: ['Windows'], // Will conflict with macOS
          supported_accelerators: ['Metal', 'CUDA', 'CPU'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string) => {
          const packageData = mockConflictedRegistryPacks.find(
            (p: any) => p.id === packageName
          )
          return Promise.resolve(packageData || null)
        }
      )

      const { shouldShowConflictModalAfterUpdate, performConflictDetection } =
        useConflictDetection()

      // First run conflict detection to populate conflicts
      await performConflictDetection()
      await nextTick()

      // Now check if modal should show after update
      const result = await shouldShowConflictModalAfterUpdate()
      expect(result).toBe(true) // Should show modal when conflicts exist and not dismissed
    })

    it('should detect system environment correctly', async () => {
      // Mock system environment
      mockSystemStatsStore.systemStats = {
        system: {
          comfyui_version: '0.3.41',
          os: 'Darwin'
        },
        devices: []
      }

      const { detectSystemEnvironment } = useConflictDetection()

      // Detect system environment
      const environment = await detectSystemEnvironment()

      expect(environment.comfyui_version).toBe('0.3.41')
    })
  })

  describe('initialization', () => {
    it('should execute initializeConflictDetection without errors', async () => {
      mockComfyManagerService.listInstalledPacks.mockResolvedValue({})

      const { initializeConflictDetection } = useConflictDetection()

      await expect(initializeConflictDetection()).resolves.not.toThrow()
    })

    it('should set initial state values correctly', () => {
      const {
        isDetecting,
        lastDetectionTime,
        detectionError,
        systemEnvironment,
        detectionResults,
        detectionSummary
      } = useConflictDetection()

      expect(isDetecting.value).toBe(false)
      expect(lastDetectionTime.value).toBeNull()
      expect(detectionError.value).toBeNull()
      expect(systemEnvironment.value).toBeNull()
      expect(detectionResults.value).toEqual([])
      expect(detectionSummary.value).toBeNull()
    })
  })
})
