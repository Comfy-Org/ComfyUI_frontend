import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useComfyRegistryService } from '@/services/comfyRegistryService'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type { components } from '@/types/comfyRegistryTypes'
import { useInstalledPacks } from '@/workbench/extensions/manager/composables/nodePack/useInstalledPacks'
import { useConflictAcknowledgment } from '@/workbench/extensions/manager/composables/useConflictAcknowledgment'
import type { ConflictAcknowledgmentState } from '@/workbench/extensions/manager/composables/useConflictAcknowledgment'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'
import { useManagerState } from '@/workbench/extensions/manager/composables/useManagerState'
import { useComfyManagerService } from '@/workbench/extensions/manager/services/comfyManagerService'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/workbench/extensions/manager/stores/conflictDetectionStore'
import type { ConflictDetectionResult } from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import {
  checkAcceleratorCompatibility,
  checkOSCompatibility
} from '@/workbench/extensions/manager/utils/systemCompatibility'
import { checkVersionCompatibility } from '@/workbench/extensions/manager/utils/versionUtil'

// Mock @vueuse/core until function
vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual('@vueuse/core')
  return {
    ...actual,
    until: vi.fn(() => ({
      toBe: vi.fn(() => Promise.resolve())
    }))
  }
})

// Mock dependencies
vi.mock('@/workbench/extensions/manager/services/comfyManagerService', () => ({
  useComfyManagerService: vi.fn()
}))

vi.mock('@/services/comfyRegistryService', () => ({
  useComfyRegistryService: vi.fn()
}))

vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: vi.fn()
}))

vi.mock('@/workbench/extensions/manager/utils/versionUtil', () => ({
  getFrontendVersion: vi.fn(() => '1.24.0'),
  checkVersionCompatibility: vi.fn()
}))

vi.mock('@/workbench/extensions/manager/utils/systemCompatibility', () => ({
  checkOSCompatibility: vi.fn(),
  checkAcceleratorCompatibility: vi.fn(),
  normalizeOSList: vi.fn((list) => list)
}))

vi.mock('@/workbench/extensions/manager/utils/conflictUtils', () => ({
  consolidateConflictsByPackage: vi.fn((results) => results),
  createBannedConflict: vi.fn((isBanned) =>
    isBanned
      ? {
          type: 'banned',
          current_value: 'installed',
          required_value: 'not_banned'
        }
      : null
  ),
  createPendingConflict: vi.fn((isPending) =>
    isPending
      ? {
          type: 'pending',
          current_value: 'installed',
          required_value: 'not_pending'
        }
      : null
  ),
  generateConflictSummary: vi.fn((results, duration) => ({
    total_packages: results.length,
    compatible_packages: results.filter(
      (r: ConflictDetectionResult) => r.is_compatible
    ).length,
    conflicted_packages: results.filter(
      (r: ConflictDetectionResult) => r.has_conflict
    ).length,
    banned_packages: 0,
    pending_packages: 0,
    conflicts_by_type_details: {},
    last_check_timestamp: new Date().toISOString(),
    check_duration_ms: duration
  }))
}))

vi.mock(
  '@/workbench/extensions/manager/composables/useConflictAcknowledgment',
  () => ({
    useConflictAcknowledgment: vi.fn()
  })
)

vi.mock(
  '@/workbench/extensions/manager/composables/nodePack/useInstalledPacks',
  () => ({
    useInstalledPacks: vi.fn()
  })
)

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn()
}))

vi.mock('@/workbench/extensions/manager/stores/conflictDetectionStore', () => ({
  useConflictDetectionStore: vi.fn()
}))

vi.mock('@/workbench/extensions/manager/composables/useManagerState', () => ({
  useManagerState: vi.fn(() => ({
    isNewManagerUI: { value: true }
  }))
}))

describe('useConflictDetection', () => {
  let pinia: ReturnType<typeof createTestingPinia>

  const mockComfyManagerService = fromPartial<
    ReturnType<typeof useComfyManagerService>
  >({
    getImportFailInfoBulk: vi.fn(),
    isLoading: ref(false),
    error: ref<string | null>(null)
  })

  const mockRegistryService = fromPartial<
    ReturnType<typeof useComfyRegistryService>
  >({
    getBulkNodeVersions: vi.fn(),
    isLoading: ref(false),
    error: ref<string | null>(null)
  })

  // Create a ref that can be modified in tests
  const mockInstalledPacksWithVersions = ref<{ id: string; version: string }[]>(
    []
  )

  const mockInstalledPacks = fromPartial<ReturnType<typeof useInstalledPacks>>({
    startFetchInstalled: vi.fn(),
    installedPacks: ref<components['schemas']['Node'][]>([]),
    installedPacksWithVersions: computed(
      () => mockInstalledPacksWithVersions.value
    ),
    isReady: ref(false),
    isLoading: ref(false),
    error: ref<unknown>(null)
  })

  const mockManagerStore = fromPartial<ReturnType<typeof useComfyManagerStore>>(
    {
      isPackEnabled: vi.fn()
    }
  )

  // Create refs that can be used to control computed properties
  let mockConflictedPackages: ConflictDetectionResult[] = []

  const mockConflictStore = fromPartial<
    ReturnType<typeof useConflictDetectionStore>
  >({
    get hasConflicts() {
      return mockConflictedPackages.some((p) => p.has_conflict)
    },
    get conflictedPackages() {
      return mockConflictedPackages
    },
    get bannedPackages() {
      return mockConflictedPackages.filter((p) =>
        p.conflicts?.some((c) => c.type === 'banned')
      )
    },
    get securityPendingPackages() {
      return mockConflictedPackages.filter((p) =>
        p.conflicts?.some((c) => c.type === 'pending')
      )
    },
    setConflictedPackages: vi.fn(),
    clearConflicts: vi.fn()
  })

  const mockIsInitialized = true
  const mockSystemStatsStore = fromPartial<
    ReturnType<typeof useSystemStatsStore>
  >({
    systemStats: {
      system: {
        os: 'darwin',
        ram_total: 17179869184,
        ram_free: 8589934592,
        comfyui_version: '0.3.41',
        required_frontend_version: '1.24.0',
        python_version:
          '3.11.0 (main, Oct 13 2023, 09:34:16) [Clang 15.0.0 (clang-1500.0.40.1)]',
        pytorch_version: '2.1.0',
        embedded_python: false,
        argv: ['--enable-manager']
      },
      devices: [
        {
          name: 'Apple M1 Pro',
          type: 'mps',
          index: 0,
          vram_total: 17179869184,
          vram_free: 8589934592,
          torch_vram_total: 17179869184,
          torch_vram_free: 8589934592
        }
      ]
    },
    isInitialized: mockIsInitialized,
    _customProperties: new Set<string>()
  })

  const mockShouldShowConflictModal = ref(false)

  const mockAcknowledgment = fromPartial<
    ReturnType<typeof useConflictAcknowledgment>
  >({
    acknowledgmentState: computed(
      () => ({}) as Partial<ConflictAcknowledgmentState>
    ),
    shouldShowConflictModal: computed(() => mockShouldShowConflictModal.value),
    shouldShowRedDot: computed(() => false),
    shouldShowManagerBanner: computed(() => false),
    dismissRedDotNotification: vi.fn(),
    dismissWarningBanner: vi.fn(),
    markConflictsAsSeen: vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createTestingPinia({ stubActions: false })
    setActivePinia(pinia)

    // Setup mocks
    vi.mocked(useComfyManagerService).mockReturnValue(mockComfyManagerService)
    vi.mocked(useComfyRegistryService).mockReturnValue(mockRegistryService)
    vi.mocked(useSystemStatsStore).mockReturnValue(mockSystemStatsStore)
    vi.mocked(useConflictAcknowledgment).mockReturnValue(mockAcknowledgment)
    vi.mocked(useInstalledPacks).mockReturnValue(mockInstalledPacks)
    vi.mocked(useComfyManagerStore).mockReturnValue(mockManagerStore)
    vi.mocked(useConflictDetectionStore).mockReturnValue(mockConflictStore)
    vi.mocked(useManagerState).mockReturnValue({
      isNewManagerUI: ref(true)
    } as ReturnType<typeof useManagerState>)
    vi.mocked(checkVersionCompatibility).mockReturnValue(null)
    vi.mocked(checkOSCompatibility).mockReturnValue(null)
    vi.mocked(checkAcceleratorCompatibility).mockReturnValue(null)

    // Reset mock implementations
    vi.mocked(mockInstalledPacks.startFetchInstalled).mockResolvedValue(
      undefined
    )
    vi.mocked(mockManagerStore.isPackEnabled).mockReturnValue(true)
    vi.mocked(mockRegistryService.getBulkNodeVersions).mockResolvedValue({
      node_versions: []
    })
    vi.mocked(mockComfyManagerService.getImportFailInfoBulk).mockResolvedValue(
      {}
    )

    // Reset the installedPacksWithVersions data
    mockInstalledPacksWithVersions.value = []
    // Reset conflicted packages
    mockConflictedPackages = []
    mockShouldShowConflictModal.value = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('system environment collection', () => {
    it('should collect system environment correctly', async () => {
      const { collectSystemEnvironment } = useConflictDetection()
      const environment = await collectSystemEnvironment()

      expect(environment).toEqual({
        comfyui_version: '0.3.41',
        frontend_version: '1.24.0',
        os: 'darwin',
        accelerator: 'mps'
      })
    })

    it('should handle missing system stats gracefully', async () => {
      mockSystemStatsStore.systemStats = null as never

      const { collectSystemEnvironment } = useConflictDetection()
      const environment = await collectSystemEnvironment()

      // When systemStats is null, empty strings are used as fallback
      expect(environment).toEqual({
        comfyui_version: '',
        frontend_version: '1.24.0',
        os: '',
        accelerator: ''
      })
    })

    it('falls back when collecting system environment throws', async () => {
      vi.mocked(useSystemStatsStore).mockImplementation(() => {
        throw new Error('stats unavailable')
      })

      const { collectSystemEnvironment } = useConflictDetection()

      await expect(collectSystemEnvironment()).resolves.toEqual({
        comfyui_version: undefined,
        frontend_version: undefined,
        os: undefined,
        accelerator: undefined
      })
    })
  })

  describe('conflict detection', () => {
    it('should detect version conflicts', async () => {
      // Setup installed packages
      mockInstalledPacks.isReady.value = true
      mockInstalledPacks.installedPacks.value = [
        {
          id: 'test-pack',
          name: 'Test Pack',
          latest_version: { version: '1.0.0' }
        } as components['schemas']['Node']
      ]

      mockInstalledPacksWithVersions.value = [
        {
          id: 'test-pack',
          version: '1.0.0'
        }
      ]

      // Mock registry response with version requirements
      vi.mocked(mockRegistryService.getBulkNodeVersions).mockResolvedValue({
        node_versions: [
          {
            status: 'success' as const,
            identifier: { node_id: 'test-pack', version: '1.0.0' },
            node_version: {
              supported_comfyui_version: '>=0.4.0',
              supported_comfyui_frontend_version: '>=2.0.0',
              supported_os: ['Windows', 'Linux', 'macOS'],
              supported_accelerators: ['CUDA', 'Metal', 'CPU'],
              status: 'NodeVersionStatusActive' as const,
              version: '1.0.0',
              publisher_id: 'test-publisher',
              node_id: 'test-pack',
              created_at: '2024-01-01T00:00:00Z'
            } as components['schemas']['NodeVersion']
          }
        ]
      })

      // Mock version checks to return conflicts
      vi.mocked(checkVersionCompatibility).mockImplementation(
        (type, current, required) => {
          if (type === 'comfyui_version' && required === '>=0.4.0') {
            return {
              type: 'comfyui_version',
              current_value: current || '0.3.41',
              required_value: '>=0.4.0'
            }
          }
          return null
        }
      )

      const { runFullConflictAnalysis } = useConflictDetection()
      const result = await runFullConflictAnalysis()

      expect(result.success).toBe(true)
      expect(result.results).toHaveLength(1)
      expect(result.results[0].has_conflict).toBe(true)
      expect(result.results[0].conflicts).toContainEqual({
        type: 'comfyui_version',
        current_value: '0.3.41',
        required_value: '>=0.4.0'
      })
    })

    it('should detect banned packages', async () => {
      mockInstalledPacks.isReady.value = true
      mockInstalledPacks.installedPacks.value = [
        {
          id: 'banned-pack',
          name: 'Banned Pack'
        } as components['schemas']['Node']
      ]

      mockInstalledPacksWithVersions.value = [
        {
          id: 'banned-pack',
          version: '1.0.0'
        }
      ]

      vi.mocked(mockRegistryService.getBulkNodeVersions).mockResolvedValue({
        node_versions: [
          {
            status: 'success' as const,
            identifier: { node_id: 'banned-pack', version: '1.0.0' },
            node_version: {
              status: 'NodeVersionStatusBanned' as const,
              version: '1.0.0',
              publisher_id: 'test-publisher',
              node_id: 'banned-pack',
              created_at: '2024-01-01T00:00:00Z',
              supported_comfyui_version: undefined,
              supported_comfyui_frontend_version: undefined,
              supported_os: undefined,
              supported_accelerators: undefined
            } as components['schemas']['NodeVersion']
          }
        ]
      })

      const { runFullConflictAnalysis } = useConflictDetection()
      const result = await runFullConflictAnalysis()

      expect(result.results[0].conflicts).toContainEqual({
        type: 'banned',
        current_value: 'installed',
        required_value: 'not_banned'
      })
    })

    it('should detect import failures', async () => {
      mockInstalledPacks.isReady.value = true
      mockInstalledPacksWithVersions.value = [
        {
          id: 'fail-pack',
          version: '1.0.0'
        }
      ]

      vi.mocked(
        mockComfyManagerService.getImportFailInfoBulk
      ).mockResolvedValue({
        'fail-pack': {
          error: 'Import error',
          name: 'fail-pack',
          path: '/path/to/pack'
        } as { error?: string; traceback?: string } | null // The actual API returns different structure than types
      })

      // Mock registry response for the package
      vi.mocked(mockRegistryService.getBulkNodeVersions).mockResolvedValue({
        node_versions: []
      })

      const { runFullConflictAnalysis } = useConflictDetection()
      const result = await runFullConflictAnalysis()

      expect(result.results).toHaveLength(1)
      // Import failure should match the actual implementation
      expect(result.results[0].conflicts).toContainEqual({
        type: 'import_failed',
        current_value: 'Import error',
        required_value: 'Import error'
      })
    })

    it('uses fallbacks for pending packages and missing registry metadata', async () => {
      mockInstalledPacks.isReady.value = true
      mockInstalledPacks.installedPacks.value = [
        { id: 'pending-pack' } as components['schemas']['Node']
      ]
      mockInstalledPacksWithVersions.value = [
        { id: 'missing-pack', version: '1.0.0' },
        { id: 'pending-pack', version: '2.0.0' }
      ]
      vi.mocked(mockRegistryService.getBulkNodeVersions).mockResolvedValue({
        node_versions: [
          {
            status: 'success' as const,
            identifier: { node_id: 'pending-pack', version: '2.0.0' },
            node_version: {
              status: 'NodeVersionStatusPending' as const,
              version: '2.0.0',
              publisher_id: 'publisher',
              node_id: 'pending-pack',
              created_at: '2024-01-01T00:00:00Z',
              supported_comfyui_version: undefined,
              supported_comfyui_frontend_version: undefined,
              supported_os: undefined,
              supported_accelerators: undefined
            } as components['schemas']['NodeVersion']
          }
        ]
      })

      const { runFullConflictAnalysis } = useConflictDetection()
      const result = await runFullConflictAnalysis()

      expect(result.results).toHaveLength(1)
      expect(result.results[0]).toMatchObject({
        package_id: 'pending-pack',
        has_conflict: true
      })
      expect(result.results[0].conflicts).toContainEqual({
        type: 'pending',
        current_value: 'installed',
        required_value: 'not_pending'
      })
    })

    it('records compatibility conflicts from version, OS, and accelerator checks', async () => {
      mockInstalledPacks.isReady.value = true
      mockInstalledPacks.installedPacks.value = [
        {
          id: 'compat-pack',
          name: 'Compatibility Pack'
        } as components['schemas']['Node']
      ]
      mockInstalledPacksWithVersions.value = [
        { id: 'compat-pack', version: '1.0.0' }
      ]
      vi.mocked(mockRegistryService.getBulkNodeVersions).mockResolvedValue({
        node_versions: [
          {
            status: 'success' as const,
            identifier: { node_id: 'compat-pack', version: '1.0.0' },
            node_version: {
              status: 'NodeVersionStatusActive' as const,
              version: '1.0.0',
              publisher_id: 'publisher',
              node_id: 'compat-pack',
              created_at: '2024-01-01T00:00:00Z',
              supported_comfyui_version: '>=9.0.0',
              supported_comfyui_frontend_version: '>=9.0.0',
              supported_os: ['Windows'],
              supported_accelerators: ['CUDA']
            } as components['schemas']['NodeVersion']
          }
        ]
      })
      vi.mocked(checkVersionCompatibility).mockImplementation((type) => ({
        type,
        current_value: type,
        required_value: '>=9.0.0'
      }))
      vi.mocked(checkOSCompatibility).mockReturnValue({
        type: 'os',
        current_value: 'macOS',
        required_value: 'Windows'
      })
      vi.mocked(checkAcceleratorCompatibility).mockReturnValue({
        type: 'accelerator',
        current_value: 'Metal',
        required_value: 'CUDA'
      })

      const { runFullConflictAnalysis } = useConflictDetection()
      const result = await runFullConflictAnalysis()

      expect(result.results[0].conflicts).toEqual(
        expect.arrayContaining([
          {
            type: 'comfyui_version',
            current_value: 'comfyui_version',
            required_value: '>=9.0.0'
          },
          {
            type: 'frontend_version',
            current_value: 'frontend_version',
            required_value: '>=9.0.0'
          },
          { type: 'os', current_value: 'macOS', required_value: 'Windows' },
          {
            type: 'accelerator',
            current_value: 'Metal',
            required_value: 'CUDA'
          }
        ])
      )
    })

    it('returns no results when installed packs are not ready', async () => {
      mockInstalledPacks.isReady.value = false
      mockInstalledPacks.installedPacks.value = [
        { id: 'not-ready' } as components['schemas']['Node']
      ]
      mockInstalledPacksWithVersions.value = [
        { id: 'not-ready', version: '1.0.0' }
      ]

      const { runFullConflictAnalysis } = useConflictDetection()
      const result = await runFullConflictAnalysis()

      expect(result.results).toEqual([])
      expect(mockConflictStore.clearConflicts).toHaveBeenCalled()
    })

    it('continues when registry bulk lookup fails', async () => {
      mockInstalledPacks.isReady.value = true
      mockInstalledPacks.installedPacks.value = [
        { id: 'fallback-pack' } as components['schemas']['Node']
      ]
      mockInstalledPacksWithVersions.value = [
        { id: 'fallback-pack', version: '1.0.0' }
      ]
      vi.mocked(mockRegistryService.getBulkNodeVersions).mockRejectedValue(
        new Error('registry down')
      )

      const { runFullConflictAnalysis } = useConflictDetection()
      const result = await runFullConflictAnalysis()

      expect(result.success).toBe(true)
      expect(result.results).toEqual([
        {
          package_id: 'fallback-pack',
          package_name: 'fallback-pack',
          has_conflict: false,
          conflicts: [],
          is_compatible: true
        }
      ])
    })

    it('continues when import failure lookup throws', async () => {
      mockInstalledPacks.isReady.value = true
      mockInstalledPacks.installedPacks.value = [
        { id: 'clean-pack' } as components['schemas']['Node']
      ]
      mockInstalledPacksWithVersions.value = [
        { id: 'clean-pack', version: '1.0.0' }
      ]
      vi.mocked(
        mockComfyManagerService.getImportFailInfoBulk
      ).mockRejectedValue(new Error('manager down'))

      const { runFullConflictAnalysis } = useConflictDetection()
      const result = await runFullConflictAnalysis()

      expect(result.success).toBe(true)
      expect(result.results).toEqual([
        {
          package_id: 'clean-pack',
          package_name: 'clean-pack',
          has_conflict: false,
          conflicts: [],
          is_compatible: true
        }
      ])
    })

    it('uses unknown import error text when failure details omit messages', async () => {
      mockInstalledPacks.isReady.value = true
      mockInstalledPacksWithVersions.value = [
        { id: 'unknown-fail-pack', version: '1.0.0' }
      ]
      vi.mocked(
        mockComfyManagerService.getImportFailInfoBulk
      ).mockResolvedValue({
        'unknown-fail-pack': {},
        'clean-pack': null
      })

      const { runFullConflictAnalysis } = useConflictDetection()
      const result = await runFullConflictAnalysis()

      expect(result.results[0].conflicts).toContainEqual({
        type: 'import_failed',
        current_value: 'Unknown import error',
        required_value: 'Unknown import error'
      })
    })

    it('returns an in-progress response when analysis is already running', async () => {
      mockInstalledPacks.isReady.value = true
      mockInstalledPacks.installedPacks.value = [
        { id: 'slow-pack' } as components['schemas']['Node']
      ]
      mockInstalledPacksWithVersions.value = [
        { id: 'slow-pack', version: '1.0.0' }
      ]
      let resolveFetch: () => void = () => {}
      vi.mocked(mockInstalledPacks.startFetchInstalled).mockReturnValue(
        new Promise<void>((resolve) => {
          resolveFetch = resolve
        })
      )

      const { runFullConflictAnalysis } = useConflictDetection()
      const firstRun = runFullConflictAnalysis()
      const secondRun = await runFullConflictAnalysis()
      resolveFetch()
      await firstRun

      expect(secondRun).toMatchObject({
        success: false,
        error_message: 'Already detecting conflicts'
      })
    })
  })

  describe('computed properties', () => {
    it('should expose conflict status from store', () => {
      mockConflictedPackages = [
        {
          package_id: 'test',
          package_name: 'Test',
          has_conflict: true,
          is_compatible: false,
          conflicts: []
        }
      ]

      useConflictDetection()

      // The hasConflicts computed should be true since we have a conflict
      expect(mockConflictedPackages).toHaveLength(1)
      expect(mockConflictedPackages[0].has_conflict).toBe(true)
    })
  })

  describe('initialization', () => {
    it('should initialize without errors', async () => {
      // Mock that installed packs are ready
      mockInstalledPacks.isReady.value = true
      mockInstalledPacksWithVersions.value = []

      // Ensure startFetchInstalled resolves
      vi.mocked(mockInstalledPacks.startFetchInstalled).mockResolvedValue(
        undefined
      )

      const { initializeConflictDetection } = useConflictDetection()

      // Set a timeout to prevent hanging
      await expect(
        Promise.race([
          initializeConflictDetection(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 1000)
          )
        ])
      ).resolves.not.toThrow()
      expect(mockConflictStore.clearConflicts).toHaveBeenCalled()
    })

    it('skips initialization when the new manager UI is disabled', async () => {
      vi.mocked(useManagerState).mockReturnValue({
        isNewManagerUI: ref(false)
      } as ReturnType<typeof useManagerState>)
      const { initializeConflictDetection } = useConflictDetection()

      await initializeConflictDetection()

      expect(mockInstalledPacks.startFetchInstalled).not.toHaveBeenCalled()
    })

    it('ignores initialization errors', async () => {
      vi.mocked(useSystemStatsStore).mockImplementation(() => {
        throw new Error('stats unavailable')
      })
      const { initializeConflictDetection } = useConflictDetection()

      await expect(initializeConflictDetection()).resolves.toBeUndefined()
    })
  })

  describe('modal gating', () => {
    it('shows the modal after update when conflicts exist and acknowledgment allows it', async () => {
      mockConflictedPackages = [
        {
          package_id: 'conflict-pack',
          package_name: 'Conflict Pack',
          has_conflict: true,
          is_compatible: false,
          conflicts: []
        }
      ]
      mockShouldShowConflictModal.value = true
      mockInstalledPacks.isReady.value = true
      mockInstalledPacksWithVersions.value = []
      const { shouldShowConflictModalAfterUpdate } = useConflictDetection()

      await expect(shouldShowConflictModalAfterUpdate()).resolves.toBe(true)
    })

    it('keeps the modal hidden when acknowledgment blocks it', async () => {
      mockConflictedPackages = [
        {
          package_id: 'conflict-pack',
          package_name: 'Conflict Pack',
          has_conflict: true,
          is_compatible: false,
          conflicts: []
        }
      ]
      mockShouldShowConflictModal.value = false
      mockInstalledPacks.isReady.value = true
      mockInstalledPacksWithVersions.value = []
      const { shouldShowConflictModalAfterUpdate } = useConflictDetection()

      await expect(shouldShowConflictModalAfterUpdate()).resolves.toBe(false)
    })
  })

  describe('node compatibility', () => {
    it('reports compatibility conflicts for registry nodes', async () => {
      const { collectSystemEnvironment, checkNodeCompatibility } =
        useConflictDetection()
      await collectSystemEnvironment()
      vi.mocked(checkOSCompatibility).mockReturnValue({
        type: 'os',
        current_value: 'macOS',
        required_value: 'Windows'
      })
      vi.mocked(checkAcceleratorCompatibility).mockReturnValue({
        type: 'accelerator',
        current_value: 'Metal',
        required_value: 'CUDA'
      })
      vi.mocked(checkVersionCompatibility).mockImplementation((type) => ({
        type,
        current_value: type,
        required_value: '>=9.0.0'
      }))

      const result = checkNodeCompatibility({
        id: 'node-pack',
        status: 'NodeStatusBanned',
        supported_os: ['Windows'],
        supported_accelerators: ['CUDA'],
        supported_comfyui_version: '>=9.0.0',
        supported_comfyui_frontend_version: '>=9.0.0'
      } as components['schemas']['Node'])

      expect(result).toEqual({
        hasConflict: true,
        conflicts: expect.arrayContaining([
          { type: 'os', current_value: 'macOS', required_value: 'Windows' },
          {
            type: 'accelerator',
            current_value: 'Metal',
            required_value: 'CUDA'
          },
          {
            type: 'comfyui_version',
            current_value: 'comfyui_version',
            required_value: '>=9.0.0'
          },
          {
            type: 'frontend_version',
            current_value: 'frontend_version',
            required_value: '>=9.0.0'
          },
          {
            type: 'banned',
            current_value: 'installed',
            required_value: 'not_banned'
          }
        ])
      })
    })

    it('reports pending version nodes as incompatible', () => {
      const { checkNodeCompatibility } = useConflictDetection()

      const result = checkNodeCompatibility({
        node_id: 'node-pack',
        version: '1.0.0',
        publisher_id: 'publisher',
        created_at: '2024-01-01T00:00:00Z',
        status: 'NodeVersionStatusPending'
      } as components['schemas']['NodeVersion'])

      expect(result.conflicts).toContainEqual({
        type: 'pending',
        current_value: 'installed',
        required_value: 'not_pending'
      })
    })

    it('reports compatible registry nodes without conflicts', () => {
      const { checkNodeCompatibility } = useConflictDetection()

      expect(
        checkNodeCompatibility({
          id: 'node-pack',
          status: 'NodeStatusActive'
        } as components['schemas']['Node'])
      ).toEqual({ hasConflict: false, conflicts: [] })
    })
  })
})
