import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useConflictDetection } from '@/composables/useConflictDetection'
import type { components } from '@/types/comfyRegistryTypes'
import type { components as ManagerComponents } from '@/types/generatedManagerTypes'

// Mock dependencies
vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: vi.fn()
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

describe('useConflictDetection with Registry Store', () => {
  const mockComfyManagerService = {
    listInstalledPacks: vi.fn()
  }

  const mockRegistryService = {
    getPackByVersion: vi.fn()
  }

  const mockSystemStatsStore = {
    fetchSystemStats: vi.fn(),
    systemStats: {
      system: {
        comfyui_version: '0.3.41',
        python_version: '3.12.11',
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

    // Reset mock system stats to default state
    mockSystemStatsStore.systemStats = {
      system: {
        comfyui_version: '0.3.41',
        python_version: '3.12.11',
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
    mockRegistryService.getPackByVersion.mockReset()

    // Mock useComfyManagerService / ComfyManagerService 모킹
    const { useComfyManagerService } = await import(
      '@/services/comfyManagerService'
    )
    vi.mocked(useComfyManagerService).mockReturnValue(
      mockComfyManagerService as any
    )

    // Mock useComfyRegistryService / ComfyRegistryService 모킹
    const { useComfyRegistryService } = await import(
      '@/services/comfyRegistryService'
    )
    vi.mocked(useComfyRegistryService).mockReturnValue(
      mockRegistryService as any
    )

    // Mock useSystemStatsStore / SystemStatsStore 모킹
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
      expect(environment.frontend_version).toBe('1.24.0-1')
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
      expect(environment.frontend_version).toBe('1.24.0-1')
      expect(environment.python_version).toBe('unknown')
      expect(environment.available_accelerators).toEqual(['cpu'])
    })
  })

  describe('package requirements detection with Registry Store', () => {
    it('should fetch and combine local + Registry data successfully', async () => {
      // Mock installed packages / 설치된 패키지 모킹
      const mockInstalledPacks: ManagerComponents['schemas']['InstalledPacksResponse'] =
        {
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

      // Mock Registry data / Registry 데이터 모킹
      const mockRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'ComfyUI-Manager',
          name: 'ComfyUI Manager',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['cuda', 'mps', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeVersionStatusActive'
        } as components['schemas']['Node'],
        {
          id: 'ComfyUI-TestNode',
          name: 'Test Node',
          supported_os: ['windows', 'linux'],
          supported_accelerators: ['cuda'],
          supported_comfyui_version: '>=0.2.0',
          status: 'NodeVersionStatusBanned'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )

      // Mock Registry Service individual calls / Registry Service 개별 호출 모킹
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string, version: string) => {
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
      expect(result.summary.total_packages).toBe(2)
      expect(result.results).toHaveLength(2)

      // Verify individual calls were made / 개별 호출이 이루어졌는지 확인
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

      // Check that Registry data was properly integrated / Registry 데이터가 제대로 통합되었는지 확인
      const managerNode = result.results.find(
        (r) => r.package_id === 'ComfyUI-Manager'
      )
      expect(managerNode?.is_compatible).toBe(true) // Should be compatible / 호환되어야 함

      // Disabled + banned node should have conflicts / 비활성화 + 금지된 노드는 충돌이 있어야 함
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
      // Mock installed packages / 설치된 패키지 모킹
      const mockInstalledPacks: ManagerComponents['schemas']['InstalledPacksResponse'] =
        {
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

      // Mock Registry Service returning null (no packages found) / Registry Service에서 null 반환 (패키지를 찾을 수 없음) 모킹
      mockRegistryService.getPackByVersion.mockResolvedValue(null)

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(1)
      expect(result.results).toHaveLength(1)

      // Should have warning about missing Registry data / Registry 데이터 누락에 대한 경고가 있어야 함
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
  })

  describe('conflict detection logic with Registry Store', () => {
    it('should detect no conflicts for fully compatible packages', async () => {
      // Mock compatible package / 호환되는 패키지 모킹
      const mockInstalledPacks: ManagerComponents['schemas']['InstalledPacksResponse'] =
        {
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
          supported_os: ['windows', 'linux', 'macos'], // Includes current OS / 현재 OS 포함
          supported_accelerators: ['mps', 'cuda', 'cpu'], // Includes current accelerator / 현재 가속기 포함
          supported_comfyui_version: '>=0.3.0', // Compatible with 0.3.41 / 0.3.41과 호환
          status: 'NodeVersionStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      // Mock Registry Service for compatible package
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string, version: string) => {
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
      // Mock OS-incompatible package / OS 비호환 패키지 모킹
      const mockInstalledPacks: ManagerComponents['schemas']['InstalledPacksResponse'] =
        {
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
          supported_os: ['windows'], // Only Windows, but we're on macOS / Windows만 지원하지만 현재는 macOS
          supported_accelerators: ['mps', 'cuda', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeVersionStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string, version: string) => {
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
            severity: 'error',
            description: expect.stringContaining('Unsupported operating system')
          })
        ])
      )
    })

    it('should detect accelerator incompatibility conflicts', async () => {
      // Mock CUDA-only package / CUDA 전용 패키지 모킹
      const mockInstalledPacks: ManagerComponents['schemas']['InstalledPacksResponse'] =
        {
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
          supported_accelerators: ['cuda'], // Only CUDA, but we have MPS / CUDA만 지원하지만 현재는 MPS
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeVersionStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string, version: string) => {
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
            severity: 'error',
            description: expect.stringContaining(
              'Required GPU/accelerator not available'
            )
          })
        ])
      )
    })

    it('should treat Registry-banned packages as conflicts', async () => {
      // Mock Registry-banned package / Registry에서 금지된 패키지 모킹
      const mockInstalledPacks: ManagerComponents['schemas']['InstalledPacksResponse'] =
        {
          BannedNode: {
            ver: '1.0.0',
            cnr_id: 'banned-node',
            aux_id: null,
            enabled: true // Enabled locally but banned in Registry / 로컬에서는 활성화되었지만 Registry에서 금지
          }
        }

      const mockBannedRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'BannedNode',
          name: 'Banned Node',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['mps', 'cuda', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeVersionStatusBanned' // Banned in Registry / Registry에서 금지됨
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string, version: string) => {
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
            severity: 'error',
            description: expect.stringContaining('Package is banned')
          })
        ])
      )
      expect(bannedNode.recommended_action.action_type).toBe('disable')
    })

    it('should treat locally disabled packages as banned', async () => {
      // Mock locally disabled package / 로컬에서 비활성화된 패키지 모킹
      const mockInstalledPacks: ManagerComponents['schemas']['InstalledPacksResponse'] =
        {
          DisabledNode: {
            ver: '1.0.0',
            cnr_id: 'disabled-node',
            aux_id: null,
            enabled: false // Disabled locally / 로컬에서 비활성화
          }
        }

      const mockActiveRegistryPacks: components['schemas']['Node'][] = [
        {
          id: 'DisabledNode',
          name: 'Disabled Node',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['mps', 'cuda', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeVersionStatusActive' // Active in Registry but disabled locally / Registry에서는 활성이지만 로컬에서 비활성
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string, version: string) => {
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
      // Mock package with OS incompatibility / OS 비호환성이 있는 패키지 모킹
      const mockInstalledPacks: ManagerComponents['schemas']['InstalledPacksResponse'] =
        {
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
          supported_os: ['windows'], // Only Windows, causing OS conflict / Windows만 지원하여 OS 충돌 발생
          supported_accelerators: ['mps', 'cuda', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeVersionStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string, version: string) => {
          const packageData = mockConflictedRegistryPacks.find(
            (p: any) => p.id === packageName
          )
          return Promise.resolve(packageData || null)
        }
      )

      const { hasConflicts, performConflictDetection } = useConflictDetection()

      // Initial value should be false / 초기값은 false여야 함
      expect(hasConflicts.value).toBe(false)

      // Execute conflict detection / 충돌 감지 실행
      await performConflictDetection()
      await nextTick()

      // Should be true when conflicts are detected / 충돌이 감지되면 true여야 함
      expect(hasConflicts.value).toBe(true)
    })

    it('should return only error-level conflicts for criticalConflicts', async () => {
      // Mock package with error-level conflict / 에러 수준 충돌이 있는 패키지 모킹
      const mockInstalledPacks: ManagerComponents['schemas']['InstalledPacksResponse'] =
        {
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
          supported_os: ['windows'], // OS conflict = error / OS 충돌 = 에러
          supported_accelerators: ['cuda'], // Accelerator conflict = error / 가속기 충돌 = 에러
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeVersionStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string, version: string) => {
          const packageData = mockErrorRegistryPacks.find(
            (p: any) => p.id === packageName
          )
          return Promise.resolve(packageData || null)
        }
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
      // Mock one banned and one normal package / 금지된 패키지 하나와 일반 패키지 하나 모킹
      const mockInstalledPacks: ManagerComponents['schemas']['InstalledPacksResponse'] =
        {
          BannedNode: {
            ver: '1.0.0',
            cnr_id: 'banned-node',
            aux_id: null,
            enabled: false // Disabled locally = banned / 로컬에서 비활성화 = 금지
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
          status: 'NodeVersionStatusActive'
        } as components['schemas']['Node'],
        {
          id: 'NormalNode',
          name: 'Normal Node',
          supported_os: ['windows', 'linux', 'macos'],
          supported_accelerators: ['mps', 'cuda', 'cpu'],
          supported_comfyui_version: '>=0.3.0',
          status: 'NodeVersionStatusActive'
        } as components['schemas']['Node']
      ]

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string, version: string) => {
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
      // Mock system stats store failure / 시스템 통계 스토어 실패 모킹
      mockSystemStatsStore.fetchSystemStats.mockRejectedValue(
        new Error('Store error')
      )
      mockSystemStatsStore.systemStats = null
      mockComfyManagerService.listInstalledPacks.mockResolvedValue({})
      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string, version: string) => {
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
      // Mock local package service failure / 로컬 패키지 서비스 실패 모킹
      mockComfyManagerService.listInstalledPacks.mockRejectedValue(
        new Error('Service error')
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(0)
    })

    it('should handle Registry Store partial data gracefully', async () => {
      // Mock successful local data but partial Registry data / 로컬 데이터는 성공하지만 부분적인 Registry 데이터 모킹
      const mockInstalledPacks: ManagerComponents['schemas']['InstalledPacksResponse'] =
        {
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
          supported_accelerators: ['mps', 'cuda', 'cpu'],
          status: 'NodeVersionStatusActive'
        } as components['schemas']['Node']
        // Package-B is missing from Registry results
      ]

      mockRegistryService.getPackByVersion.mockImplementation(
        (packageName: string, version: string) => {
          const packageData = mockPartialRegistryPacks.find(
            (p: any) => p.id === packageName
          )
          return Promise.resolve(packageData || null)
        }
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(2)

      // Package A should have Registry data / Package A는 Registry 데이터가 있어야 함
      const packageA = result.results.find((r) => r.package_id === 'Package-A')
      expect(packageA?.conflicts).toHaveLength(0) // No conflicts / 충돌 없음

      // Package B should have warning about missing Registry data / Package B는 Registry 데이터 누락 경고가 있어야 함
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
      // Mock all stores/services failing / 모든 스토어/서비스 실패 모킹
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

      expect(result.success).toBe(true) // Error resilience maintains success / 에러 복원력으로 성공 유지
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
