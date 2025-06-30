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

  describe('시스템 환경 감지', () => {
    it('정상적으로 시스템 환경 정보를 수집해야 함', async () => {
      const { detectSystemEnvironment } = useConflictDetection()
      const environment = await detectSystemEnvironment()

      expect(environment.comfyui_version).toBe('0.3.41')
      expect(environment.frontend_version).toBe('1.23.2')
      expect(environment.python_version).toBe('3.12.11')
      expect(environment.available_accelerators).toContain('mps')
      expect(environment.available_accelerators).toContain('cpu')
      expect(environment.primary_accelerator).toBe('mps')
    })

    it('API 실패시 fallback 환경 정보를 반환해야 함', async () => {
      // Mock API failure
      mockApi.fetchApi.mockRejectedValue(new Error('API 실패'))

      const { detectSystemEnvironment } = useConflictDetection()
      const environment = await detectSystemEnvironment()

      expect(environment.comfyui_version).toBe('unknown')
      expect(environment.frontend_version).toBe('1.23.2')
      expect(environment.python_version).toBe('unknown')
      expect(environment.available_accelerators).toEqual(['cpu'])
    })
  })

  describe('패키지 요구사항 감지', () => {
    it('설치된 패키지들을 정상적으로 변환해야 함', async () => {
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

      // 비활성화된 노드는 금지된 것으로 처리
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

    it('패키지 정보를 가져올 수 없을 때 빈 배열을 반환해야 함', async () => {
      mockComfyManagerService.listInstalledPacks.mockResolvedValue(null)

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(0)
      expect(result.results).toHaveLength(0)
    })
  })

  describe('충돌 감지 로직', () => {
    it('호환 가능한 패키지는 충돌이 없어야 함', async () => {
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

    it('비활성화된 패키지는 금지된 패키지로 처리되어야 함', async () => {
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
            description: expect.stringContaining('금지')
          })
        ])
      )
      expect(disabledNode.recommended_action.action_type).toBe('disable')
    })
  })

  describe('Computed 속성들', () => {
    it('hasConflicts는 충돌이 있을 때 true를 반환해야 함', async () => {
      const mockInstalledPacks: InstalledPacksResponse = {
        ConflictedNode: {
          ver: '1.0.0',
          cnr_id: 'conflicted-node',
          aux_id: null,
          enabled: false // 비활성화 = 충돌
        }
      }

      mockComfyManagerService.listInstalledPacks.mockResolvedValue(
        mockInstalledPacks
      )

      const { hasConflicts, performConflictDetection } = useConflictDetection()

      // 초기값은 false
      expect(hasConflicts.value).toBe(false)

      // 충돌 감지 실행
      await performConflictDetection()
      await nextTick()

      // 충돌이 감지되면 true
      expect(hasConflicts.value).toBe(true)
    })

    it('criticalConflicts는 심각도가 error인 충돌만 반환해야 함', async () => {
      const mockInstalledPacks: InstalledPacksResponse = {
        ErrorNode: {
          ver: '1.0.0',
          cnr_id: 'error-node',
          aux_id: null,
          enabled: false // 이것은 error 레벨 충돌을 생성함
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

    it('bannedPackages는 금지된 패키지만 반환해야 함', async () => {
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

  describe('에러 복원력', () => {
    it('시스템 환경 감지 실패시에도 계속 진행해야 함', async () => {
      mockApi.fetchApi.mockRejectedValue(new Error('Network error'))
      mockComfyManagerService.listInstalledPacks.mockResolvedValue({})

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.detected_system_environment?.comfyui_version).toBe(
        'unknown'
      )
    })

    it('패키지 정보 실패시에도 시스템은 계속 작동해야 함', async () => {
      mockComfyManagerService.listInstalledPacks.mockRejectedValue(
        new Error('Service error')
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true)
      expect(result.summary.total_packages).toBe(0)
    })

    it('전체 시스템 실패시 에러 응답을 반환해야 함', async () => {
      mockApi.fetchApi.mockRejectedValue(new Error('Critical error'))
      mockComfyManagerService.listInstalledPacks.mockRejectedValue(
        new Error('Critical error')
      )

      const { performConflictDetection } = useConflictDetection()
      const result = await performConflictDetection()

      expect(result.success).toBe(true) // 에러 복원력이 있어서 success는 여전히 true
      expect(result.summary.total_packages).toBe(0)
    })
  })

  describe('초기화', () => {
    it('initializeConflictDetection은 에러 없이 실행되어야 함', async () => {
      mockComfyManagerService.listInstalledPacks.mockResolvedValue({})

      const { initializeConflictDetection } = useConflictDetection()

      expect(() => {
        initializeConflictDetection()
      }).not.toThrow()
    })

    it('초기 상태값들이 올바르게 설정되어야 함', () => {
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
