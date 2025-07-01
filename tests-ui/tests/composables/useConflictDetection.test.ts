import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useConflictDetection } from '@/composables/useConflictDetection'
import type { InstalledPacksResponse } from '@/types/comfyManagerTypes'
import type { components } from '@/types/comfyRegistryTypes'

// Mock dependencies
vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn()
  }
}))

vi.mock('@/services/comfyManagerService', () => ({
  useComfyManagerService: vi.fn()
}))

vi.mock('@/stores/comfyRegistryStore', () => ({
  useComfyRegistryStore: vi.fn()
}))

vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: vi.fn()
}))

vi.mock('@/config', () => ({
  default: {
    app_version: '1.23.2'
  }
}))

// Mock import.meta.env
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_APP_VERSION: '1.23.2',
        MODE: 'test'
      }
    }
  }
})

describe('useConflictDetection with Registry Store', () => {
  const mockComfyManagerService = {
    listInstalledPacks: vi.fn(),
    getImportFailInfo: vi.fn()
  }

  const mockRegistryStore = {
    getPacksByIds: {
      call: vi.fn()
    }
  }

  const mockSystemStatsStore = {
    fetchSystemStats: vi.fn(),
    systemStats: {
      system: {
        comfyui_version: '0.3.41',
        python_version: '3.12.11'
      },
      devices: [
        {
          type: 'mps',
          vram_total: 17179869184
        }
      ]
    } as any
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Mock useComfyManagerService
    const { useComfyManagerService } = await import(
      '@/services/comfyManagerService'
    )
    vi.mocked(useComfyManagerService).mockReturnValue(
      mockComfyManagerService as any
    )

    // Mock useComfyRegistryStore
    const { useComfyRegistryStore } = await import(
      '@/stores/comfyRegistryStore'
    )
    vi.mocked(useComfyRegistryStore).mockReturnValue(mockRegistryStore as any)

    // Mock useSystemStatsStore
    const { useSystemStatsStore } = await import('@/stores/systemStatsStore')
    vi.mocked(useSystemStatsStore).mockReturnValue(mockSystemStatsStore as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('system environment detection', () => {
    it('should collect system environment information successfully', async () => {
      const { detectSystemEnvironment } = useConflictDetection()
      const environment = await detectSystemEnvironment()

      expect(environment.comfyui_version).toBe('0.3.41')
      expect(environment.frontend_version).toBe('1.23.2')
      expect(environment.python_version).toBe('3.12.11')
      expect(environment.available_accelerators).toContain('mps')
      expect(environment.available_accelerators).toContain('cpu')
      expect(environment.primary_accelerator).toBe('mps')
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
      expect(environment.frontend_version).toBe('1.23.2')
      expect(environment.python_version).toBe('unknown')
      expect(environment.available_accelerators).toEqual(['cpu'])
      expect(environment.primary_accelerator).toBe('cpu')
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

      // Mock import failure info
      const mockImportFailInfo = {}

      // Mock Registry data
      const mockRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'ComfyUI-Manager',
          name: 'ComfyUI Manager',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['cuda', 'mps', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node'],
        {
          id: 'ComfyUI-TestNode',
          name: 'Test Node',
          supported_os: ['windows', 'linux'],
          supported_accelerators: ['cuda'],
          supported_comfyui_version: '>=0.2.0',
          status: 'NodeStatusBanned'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockComfyManagerService.getImportFailInfo.mockResolvedValue(
        mockImportFailInfo
      )

      // Mock Registry Store batch call
      mockRegistryStore.getPacksByIds.call.mockResolvedValue(mockRegistryPacks)

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(2)
      expect(result.results).toHaveLength(2)

      // Verify batch call was made with correct package IDs
      expect(mockRegistryStore.getPacksByIds.call).toHaveBeenCalledWith([
        'ComfyUI-Manager',
        'ComfyUI-TestNode'
      ])

      // Check that Registry data was properly integrated
      const managerNode = result.results.find(
        (r) => r.package_id === 'ComfyUI-Manager'
      )
      expect(managerNode?.is_compatible).toBe(true) // Should be compatible

      // Disabled + banned node should have conflicts
      const testNode = result.results.find(
        (r) => r.package_id === 'ComfyUI-TestNode'
      )
      expect(testNode?.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'banned',
            severity: 'error'
          })
        ])
      )
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
      mockComfyManagerService.getImportFailInfo.mockResolvedValue({})

      // Mock Registry Store returning empty array (no packages found)
      mockRegistryStore.getPacksByIds.call.mockResolvedValue([])

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
            type: 'security_pending',
            severity: 'warning',
            description: expect.stringContaining('Registry data not available')
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

    it('should detect import failures and add import_failed conflicts', async () => {
      // Mock installed packages
      const mockInstalledPacks: InstalledPacksResponse = {
        ImportFailedNode: {
          ver: '1.0.0',
          cnr_id: 'import-failed-node',
          aux_id: null,
          enabled: true
        },
        WorkingNode: {
          ver: '1.0.0',
          cnr_id: 'working-node',
          aux_id: null,
          enabled: true
        }
      }

      // Mock import failure info with one failing package
      const mockImportFailInfo = {
        ImportFailedNode:
          "ModuleNotFoundError: No module named 'some_dependency'"
      }

      // Mock Registry data
      const mockRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'ImportFailedNode',
          name: 'Import Failed Node',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['cuda', 'mps', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node'],
        {
          id: 'WorkingNode',
          name: 'Working Node',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['cuda', 'mps', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockComfyManagerService.getImportFailInfo.mockResolvedValue(
        mockImportFailInfo
      )
      mockRegistryStore.getPacksByIds.call.mockResolvedValue(mockRegistryPacks)

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(2)
      expect(result.results).toHaveLength(2)

      // Check that the import failed node has import_failed conflict
      const importFailedNode = result.results.find(
        (r) => r.package_id === 'ImportFailedNode'
      )
      expect(importFailedNode?.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'import_failed',
            severity: 'error',
            description: expect.stringContaining('ModuleNotFoundError')
          })
        ])
      )

      // Check that the working node has no import failures
      const workingNode = result.results.find(
        (r) => r.package_id === 'WorkingNode'
      )
      expect(
        workingNode?.conflicts.some((c) => c.type === 'import_failed')
      ).toBe(false)
    })

    it('should handle getImportFailInfo API failures gracefully', async () => {
      // Mock installed packages
      const mockInstalledPacks: InstalledPacksResponse = {
        TestNode: {
          ver: '1.0.0',
          cnr_id: 'test-node',
          aux_id: null,
          enabled: true
        }
      }

      // Mock Registry data
      const mockRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'TestNode',
          name: 'Test Node',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['cuda', 'mps', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      // Mock import fail info API failure
      mockComfyManagerService.getImportFailInfo.mockRejectedValue(
        new Error('API failure')
      )
      mockRegistryStore.getPacksByIds.call.mockResolvedValue(mockRegistryPacks)

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(1)
      expect(result.results).toHaveLength(1)

      // Should continue without import failure info
      const testNode = result.results[0]
      expect(testNode.conflicts.some((c) => c.type === 'import_failed')).toBe(
        false
      )
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
          supported_os: ['windows', 'linux', 'macos'], // Includes all OS
          supported_accelerators: ['mps', 'cuda', 'cpu'], // Includes all accelerators
          supported_comfyui_version: '>=0.3.0', // Compatible with 0.3.41
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockComfyManagerService.getImportFailInfo.mockResolvedValue({})
      mockRegistryStore.getPacksByIds.call.mockResolvedValue(
        mockCompatibleRegistryPacks
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
          supported_os: ['windows'], // Only Windows, but we're on macOS
          supported_accelerators: ['mps', 'cuda', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockComfyManagerService.getImportFailInfo.mockResolvedValue({})
      mockRegistryStore.getPacksByIds.call.mockResolvedValue(
        mockWindowsOnlyRegistryPacks
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
            severity: 'error',
            description: expect.stringContaining('Unsupported operating system')
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
          supported_accelerators: ['cuda'], // Only CUDA, but we have MPS
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockComfyManagerService.getImportFailInfo.mockResolvedValue({})
      mockRegistryStore.getPacksByIds.call.mockResolvedValue(
        mockCudaOnlyRegistryPacks
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
            severity: 'error',
            description: expect.stringContaining(
              'Required GPU/accelerator not available'
            )
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
          enabled: true // Enabled locally but banned in Registry
        }
      }

      const mockBannedRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'BannedNode',
          name: 'Banned Node',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['mps', 'cuda', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusBanned' // Banned in Registry
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockComfyManagerService.getImportFailInfo.mockResolvedValue({})
      mockRegistryStore.getPacksByIds.call.mockResolvedValue(
        mockBannedRegistryPacks
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
            severity: 'error',
            description: expect.stringContaining(
              'Package is banned in Registry'
            )
          })
        ])
      )
      expect(bannedNode.recommended_action.action_type).toBe('disable')
    })

    it('should treat locally disabled packages as banned', async () => {
      // Mock locally disabled package
      const mockInstalledPacks: InstalledPacksResponse = {
        DisabledNode: {
          ver: '1.0.0',
          cnr_id: 'disabled-node',
          aux_id: null,
          enabled: false // Disabled locally
        }
      }

      const mockActiveRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'DisabledNode',
          name: 'Disabled Node',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['mps', 'cuda', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive' // Active in Registry but disabled locally
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockComfyManagerService.getImportFailInfo.mockResolvedValue({})
      mockRegistryStore.getPacksByIds.call.mockResolvedValue(
        mockActiveRegistryPacks
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
            severity: 'error',
            description: expect.stringContaining('Package is disabled locally')
          })
        ])
      )
      expect(disabledNode.recommended_action.action_type).toBe('disable')
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
          supported_os: ['windows'], // Only Windows, causing OS conflict
          supported_accelerators: ['mps', 'cuda', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockComfyManagerService.getImportFailInfo.mockResolvedValue({})
      mockRegistryStore.getPacksByIds.call.mockResolvedValue(
        mockConflictedRegistryPacks
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

    it('should return only error-level conflicts for criticalConflicts', async () => {
      // Mock package with error-level conflict
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
          supported_os: ['windows'], // OS conflict = error
          supported_accelerators: ['cuda'], // Accelerator conflict = error
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockComfyManagerService.getImportFailInfo.mockResolvedValue({})
      mockRegistryStore.getPacksByIds.call.mockResolvedValue(
        mockErrorRegistryPacks
      )

      const { criticalConflicts, performConflictDetection } =
        useConflictDetection()

      await performConflictDetection()
      await nextTick()

      expect(criticalConflicts.value.length).toBeGreaterThan(0)
      expect(
        criticalConflicts.value.every(
          (conflict) => conflict.severity === 'error'
        )
      ).toBe(true)
    })

    it('should return only banned packages for bannedPackages', async () => {
      // Mock one banned and one normal package
      const mockInstalledPacks: InstalledPacksResponse = {
        BannedNode: {
          ver: '1.0.0',
          cnr_id: 'banned-node',
          aux_id: null,
          enabled: false // Disabled locally = banned
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
          supported_accelerators: ['mps', 'cuda', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node'],
        {
          id: 'NormalNode',
          name: 'Normal Node',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['mps', 'cuda', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockComfyManagerService.getImportFailInfo.mockResolvedValue({})
      mockRegistryStore.getPacksByIds.call.mockResolvedValue(mockRegistryPacks)

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
      mockComfyManagerService.getImportFailInfo.mockResolvedValue({})
      mockRegistryStore.getPacksByIds.call.mockResolvedValue([])

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
        'Package-A': { ver: '1.0.0', cnr_id: 'a', aux_id: null, enabled: true },
        'Package-B': { ver: '2.0.0', cnr_id: 'b', aux_id: null, enabled: true }
      }

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockComfyManagerService.getImportFailInfo.mockResolvedValue({})

      // Only first package found in Registry
      const mockPartialRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'Package-A',
          name: 'Package A',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['mps', 'cuda', 'cpu'],
          status: 'NodeStatusActive'
        } as components['schemas']['Node']
        // Package-B is missing from Registry results
      ]

      mockRegistryStore.getPacksByIds.call.mockResolvedValue(
        mockPartialRegistryPacks
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(2)

      // Package A should have Registry data
      const packageA = result.results.find((r) => r.package_id === 'Package-A')
      expect(packageA?.conflicts).toHaveLength(0) // No conflicts

      // Package B should have warning about missing Registry data
      const packageB = result.results.find((r) => r.package_id === 'Package-B')
      expect(packageB?.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'security_pending',
            severity: 'warning',
            description: expect.stringContaining('Registry data not available')
          })
        ])
      )
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
      mockComfyManagerService.getImportFailInfo.mockRejectedValue(
        new Error('Critical error')
      )
      mockRegistryStore.getPacksByIds.call.mockRejectedValue(
        new Error('Critical error')
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true) // Error resilience maintains success
      expect(result.summary.total_packages).toBe(0)
    })
  })

  describe('initialization', () => {
    it('should execute initializeConflictDetection without errors', async () => {
      mockComfyManagerService.listInstalledPacks.mockResolvedValue({})
      mockComfyManagerService.getImportFailInfo.mockResolvedValue({})

      const { initializeConflictDetection } = useConflictDetection()

      expect(() => {
        initializeConflictDetection()
      }).not.toThrow()
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
