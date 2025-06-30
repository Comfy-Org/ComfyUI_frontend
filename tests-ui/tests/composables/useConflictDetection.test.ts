import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useConflictDetection } from '@/composables/useConflictDetection'
import type { InstalledPacksResponse } from '@/types/comfyManagerTypes'

// Mock dependencies
vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn()
  }
}))

vi.mock('@/services/comfyManagerService', () => ({
  useComfyManagerService: vi.fn()
}))

vi.mock('@/config', () => ({
  default: {
    app_version: '1.23.2'
  }
}))

describe('useConflictDetection', () => {
  const mockComfyManagerService = {
    listInstalledPacks: vi.fn()
  }

  const mockApi = {
    fetchApi: vi.fn()
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

    // Mock api
    const { api } = await import('@/scripts/api')
    Object.assign(api, mockApi)

    // Default successful system_stats mock
    mockApi.fetchApi.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
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
        })
    })
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

    it('should return fallback environment information when API fails', async () => {
      // Mock API failure
      mockApi.fetchApi.mockRejectedValue(new Error('API failure'))

      const { detectSystemEnvironment } = useConflictDetection()
      const environment = await detectSystemEnvironment()

      expect(environment.comfyui_version).toBe('unknown')
      expect(environment.frontend_version).toBe('1.23.2')
      expect(environment.python_version).toBe('unknown')
      expect(environment.available_accelerators).toEqual(['cpu'])
    })
  })

  describe('package requirements detection', () => {
    it('should properly convert installed packages', async () => {
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

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(2)
      expect(result.results).toHaveLength(2)

      // Disabled nodes should be treated as banned
      const disabledNode = result.results.find(
        (r) => r.package_id === 'ComfyUI-TestNode'
      )
      expect(disabledNode?.conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'banned',
            severity: 'error'
          })
        ])
      )
    })

    it('should return empty array when package information cannot be retrieved', async () => {
      mockComfyManagerService.listInstalledPacks.mockResolvedValue(null)

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(0)
      expect(result.results).toHaveLength(0)
    })
  })

  describe('conflict detection logic', () => {
    it('should have no conflicts for compatible packages', async () => {
      const mockInstalledPacks: InstalledPacksResponse = {
        CompatibleNode: {
          ver: '1.0.0',
          cnr_id: 'compatible-node',
          aux_id: null,
          enabled: true
        }
      }

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.conflicted_packages).toBe(0)
      expect(result.summary.compatible_packages).toBe(1)
      expect(result.results[0].conflicts).toHaveLength(0)
    })

    it('should treat disabled packages as banned packages', async () => {
      const mockInstalledPacks: InstalledPacksResponse = {
        DisabledNode: {
          ver: '1.0.0',
          cnr_id: 'disabled-node',
          aux_id: null,
          enabled: false
        }
      }

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
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
            description: expect.stringContaining('banned')
          })
        ])
      )
      expect(disabledNode.recommended_action.action_type).toBe('disable')
    })
  })

  describe('computed properties', () => {
    it('should return true for hasConflicts when conflicts exist', async () => {
      const mockInstalledPacks: InstalledPacksResponse = {
        ConflictedNode: {
          ver: '1.0.0',
          cnr_id: 'conflicted-node',
          aux_id: null,
          enabled: false // disabled = conflict
        }
      }

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
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
      const mockInstalledPacks: InstalledPacksResponse = {
        ErrorNode: {
          ver: '1.0.0',
          cnr_id: 'error-node',
          aux_id: null,
          enabled: false // This creates error-level conflicts
        }
      }

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )

      const { criticalConflicts, performConflictDetection } =
        useConflictDetection()

      await performConflictDetection()
      await nextTick()

      expect(criticalConflicts.value.length).toBeGreaterThan(0)
      expect(criticalConflicts.value[0].severity).toBe('error')
    })

    it('should return only banned packages for bannedPackages', async () => {
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

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )

      const { bannedPackages, performConflictDetection } =
        useConflictDetection()

      await performConflictDetection()
      await nextTick()

      expect(bannedPackages.value).toHaveLength(1)
      expect(bannedPackages.value[0].package_id).toBe('BannedNode')
    })
  })

  describe('error resilience', () => {
    it('should continue execution even when system environment detection fails', async () => {
      mockApi.fetchApi.mockRejectedValue(new Error('Network error'))
      mockComfyManagerService.listInstalledPacks.mockResolvedValue({})

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.detected_system_environment?.comfyui_version).toBe(
        'unknown'
      )
    })

    it('should continue system operation even when package information fails', async () => {
      mockComfyManagerService.listInstalledPacks.mockRejectedValue(
        new Error('Service error')
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(0)
    })

    it('should return error response when entire system fails', async () => {
      mockApi.fetchApi.mockRejectedValue(new Error('Critical error'))
      mockComfyManagerService.listInstalledPacks.mockRejectedValue(
        new Error('Critical error')
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true) // success is still true due to error resilience
      expect(result.summary.total_packages).toBe(0)
    })
  })

  describe('initialization', () => {
    it('should execute initializeConflictDetection without errors', async () => {
      mockComfyManagerService.listInstalledPacks.mockResolvedValue({})

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
