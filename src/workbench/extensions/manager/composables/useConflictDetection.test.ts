import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useComfyRegistryService } from '@/services/comfyRegistryService'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type { components } from '@/types/comfyRegistryTypes'
import { useInstalledPacks } from '@/workbench/extensions/manager/composables/nodePack/useInstalledPacks'
import { useConflictAcknowledgment } from '@/workbench/extensions/manager/composables/useConflictAcknowledgment'
import { useConflictDetection } from '@/workbench/extensions/manager/composables/useConflictDetection'
import { useComfyManagerService } from '@/workbench/extensions/manager/services/comfyManagerService'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/workbench/extensions/manager/stores/conflictDetectionStore'
import type { ConflictDetectionResult } from '@/workbench/extensions/manager/types/conflictDetectionTypes'
import type * as ConflictUtils from '@/workbench/extensions/manager/utils/conflictUtils'
import {
  checkAcceleratorCompatibility,
  checkOSCompatibility
} from '@/workbench/extensions/manager/utils/systemCompatibility'
import { checkVersionCompatibility } from '@/workbench/extensions/manager/utils/versionUtil'

vi.mock('@vueuse/core', () => ({
  until: vi.fn(() => ({
    toBe: vi.fn(() => Promise.resolve())
  }))
}))

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
  checkVersionCompatibility: vi.fn(() => null)
}))

vi.mock('@/workbench/extensions/manager/utils/systemCompatibility', () => ({
  checkOSCompatibility: vi.fn(() => null),
  checkAcceleratorCompatibility: vi.fn(() => null),
  normalizeOSList: vi.fn((list) => list)
}))

vi.mock('@/workbench/extensions/manager/utils/conflictUtils', async () => {
  const actual = await vi.importActual<typeof ConflictUtils>(
    '@/workbench/extensions/manager/utils/conflictUtils'
  )
  return {
    ...actual,
    consolidateConflictsByPackage: vi.fn((results) => results)
  }
})

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

  const mockComfyManagerService = {
    getImportFailInfoBulk: vi.fn(),
    isLoading: ref(false),
    error: ref<string | null>(null)
  } as Partial<ReturnType<typeof useComfyManagerService>> as ReturnType<
    typeof useComfyManagerService
  >

  const mockRegistryService = {
    getBulkNodeVersions: vi.fn(),
    isLoading: ref(false),
    error: ref<string | null>(null)
  } as Partial<ReturnType<typeof useComfyRegistryService>> as ReturnType<
    typeof useComfyRegistryService
  >

  // Create a ref that can be modified in tests
  const mockInstalledPacksWithVersions = ref<{ id: string; version: string }[]>(
    []
  )

  const mockInstalledPacks = {
    startFetchInstalled: vi.fn(),
    installedPacks: ref<components['schemas']['Node'][]>([]),
    installedPacksWithVersions: computed(
      () => mockInstalledPacksWithVersions.value
    ),
    isReady: ref(false),
    isLoading: ref(false),
    error: ref<unknown>(null)
  } as Partial<ReturnType<typeof useInstalledPacks>> as ReturnType<
    typeof useInstalledPacks
  >

  const mockManagerStore = {
    isPackEnabled: vi.fn()
  } as Partial<ReturnType<typeof useComfyManagerStore>> as ReturnType<
    typeof useComfyManagerStore
  >

  // Create refs that can be used to control computed properties
  let mockConflictedPackages: ConflictDetectionResult[] = []

  const mockConflictStore = {
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
    getConflictsForPackageByID: (packageId: string) =>
      mockConflictedPackages.find((pkg) => pkg.package_id === packageId),
    setConflictedPackages: vi.fn(),
    clearConflicts: vi.fn(),
    setRegistryUnknownPackIds: vi.fn()
  } as Partial<ReturnType<typeof useConflictDetectionStore>> as ReturnType<
    typeof useConflictDetectionStore
  >

  const mockIsInitialized = true
  const mockSystemStatsStore = {
    systemStats: {
      system: {
        os: 'darwin', // sys.platform returns 'darwin' for macOS
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
  } as Partial<ReturnType<typeof useSystemStatsStore>> as ReturnType<
    typeof useSystemStatsStore
  >

  const mockAcknowledgment: ReturnType<typeof useConflictAcknowledgment> = {
    acknowledgmentState: computed(() => ({
      modal_dismissed: false,
      red_dot_dismissed: false,
      warning_banner_dismissed: false
    })),
    shouldShowConflictModal: computed(() => false),
    shouldShowRedDot: computed(() => false),
    shouldShowManagerBanner: computed(() => false),
    dismissRedDotNotification: vi.fn(),
    dismissWarningBanner: vi.fn(),
    markConflictsAsSeen: vi.fn()
  }

  beforeEach(() => {
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
      mockSystemStatsStore.systemStats = null

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
        }
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
        }
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
  })

  describe('bulk version request chunking', () => {
    const packIds = (count: number) =>
      Array.from({ length: count }, (_, index) => `pack-${index}`)

    const installPacks = (count: number) => {
      mockInstalledPacks.isReady.value = true
      mockInstalledPacksWithVersions.value = packIds(count).map((id) => ({
        id,
        version: '1.0.0'
      }))
    }

    const bulkCalls = () =>
      vi.mocked(mockRegistryService.getBulkNodeVersions).mock.calls

    const bannedResponse = (
      nodeVersions: components['schemas']['NodeVersionIdentifier'][]
    ) => ({
      node_versions: nodeVersions.map((identifier) => ({
        status: 'success' as const,
        identifier,
        node_version: {
          status: 'NodeVersionStatusBanned' as const,
          version: identifier.version,
          publisher_id: 'test-publisher',
          node_id: identifier.node_id,
          created_at: '2024-01-01T00:00:00Z'
        } as components['schemas']['NodeVersion']
      }))
    })

    const bannedPackIds = (results: ConflictDetectionResult[]) =>
      results
        .filter((result) =>
          result.conflicts?.some((conflict) => conflict.type === 'banned')
        )
        .map((result) => result.package_id)

    it('splits a large install into chunks of 100, covering every pack exactly once', async () => {
      installPacks(250)

      const { runFullConflictAnalysis } = useConflictDetection()
      await runFullConflictAnalysis()

      const calls = bulkCalls()
      expect(calls.map(([nodeVersions]) => nodeVersions.length)).toEqual([
        100, 100, 50
      ])
      expect(
        calls.flatMap(([nodeVersions]) =>
          nodeVersions.map(({ node_id }) => node_id)
        )
      ).toEqual(packIds(250))
      expect(calls.every(([, signal]) => signal instanceof AbortSignal)).toBe(
        true
      )
    })

    it('merges version data from every chunk', async () => {
      installPacks(250)
      vi.mocked(mockRegistryService.getBulkNodeVersions).mockImplementation(
        (nodeVersions) => Promise.resolve(bannedResponse(nodeVersions))
      )

      const { runFullConflictAnalysis } = useConflictDetection()
      const { results } = await runFullConflictAnalysis()

      expect(bannedPackIds(results)).toEqual(packIds(250))
    })

    it('keeps the remaining chunks version data when one chunk request fails', async () => {
      installPacks(250)
      vi.mocked(mockRegistryService.getBulkNodeVersions).mockImplementation(
        (nodeVersions) =>
          Promise.resolve(
            nodeVersions.some(({ node_id }) => node_id === 'pack-0')
              ? null
              : bannedResponse(nodeVersions)
          )
      )

      const { runFullConflictAnalysis } = useConflictDetection()
      const { results } = await runFullConflictAnalysis()

      expect(bannedPackIds(results)).toEqual(packIds(250).slice(100))
    })

    it('keeps the remaining chunks version data when one chunk request throws', async () => {
      installPacks(250)
      vi.mocked(mockRegistryService.getBulkNodeVersions).mockImplementation(
        (nodeVersions) =>
          nodeVersions.some(({ node_id }) => node_id === 'pack-0')
            ? Promise.reject(new Error('network down'))
            : Promise.resolve(bannedResponse(nodeVersions))
      )

      const { runFullConflictAnalysis } = useConflictDetection()
      const { results } = await runFullConflictAnalysis()

      expect(bannedPackIds(results)).toEqual(packIds(250).slice(100))
    })

    it('bounds how many chunk requests are in flight at once', async () => {
      installPacks(1000)
      let inFlightRequests = 0
      let peakInFlightRequests = 0
      vi.mocked(mockRegistryService.getBulkNodeVersions).mockImplementation(
        async (nodeVersions) => {
          inFlightRequests += 1
          peakInFlightRequests = Math.max(
            peakInFlightRequests,
            inFlightRequests
          )
          await Promise.resolve()
          inFlightRequests -= 1
          return bannedResponse(nodeVersions)
        }
      )

      const { runFullConflictAnalysis } = useConflictDetection()
      await runFullConflictAnalysis()

      expect(bulkCalls()).toHaveLength(10)
      expect(peakInFlightRequests).toBeLessThanOrEqual(4)
    })

    it('stops dispatching queued chunks once the run is cancelled', async () => {
      installPacks(500)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const releaseRequest: (() => void)[] = []
      let holdRequests = true
      vi.mocked(mockRegistryService.getBulkNodeVersions).mockImplementation(
        async (nodeVersions) => {
          if (holdRequests) {
            await new Promise<void>((resolve) => releaseRequest.push(resolve))
          }
          return bannedResponse(nodeVersions)
        }
      )

      const { runFullConflictAnalysis, cancelRequests } = useConflictDetection()
      const analysis = runFullConflictAnalysis()
      await vi.waitFor(() => expect(releaseRequest.length).toBeGreaterThan(0))
      const dispatchedBeforeCancel = bulkCalls().length

      cancelRequests()
      holdRequests = false
      releaseRequest.forEach((release) => release())
      await analysis

      expect(bulkCalls()).toHaveLength(dispatchedBeforeCancel)
      expect(dispatchedBeforeCancel).toBeLessThan(5)
      expect(
        warn.mock.calls.filter(([message]) =>
          String(message).includes('Failed to fetch bulk version data')
        )
      ).toEqual([])
    })

    it('sends a single request when the install fits in one chunk', async () => {
      installPacks(50)

      const { runFullConflictAnalysis } = useConflictDetection()
      await runFullConflictAnalysis()

      expect(bulkCalls()).toHaveLength(1)
      expect(bulkCalls()[0][0]).toHaveLength(50)
    })

    describe('unverified registry status', () => {
      const activeResponse = (
        nodeVersions: components['schemas']['NodeVersionIdentifier'][]
      ) => ({
        node_versions: nodeVersions.map((identifier) => ({
          status: 'success' as const,
          identifier,
          node_version: {
            status: 'NodeVersionStatusActive' as const,
            version: identifier.version,
            publisher_id: 'test-publisher',
            node_id: identifier.node_id,
            created_at: '2024-01-01T00:00:00Z'
          } as components['schemas']['NodeVersion']
        }))
      })

      const unknownPackIds = (results: ConflictDetectionResult[]) =>
        results
          .filter((result) => result.registry_status_unknown)
          .map((result) => result.package_id)

      const isFirstChunk = (
        nodeVersions: components['schemas']['NodeVersionIdentifier'][]
      ) => nodeVersions.some(({ node_id }) => node_id === 'pack-0')

      const bannedConflict = {
        type: 'banned' as const,
        current_value: 'installed',
        required_value: 'not_banned'
      }

      it.for([
        { outcome: 'resolves null', fail: () => Promise.resolve(null) },
        {
          outcome: 'rejects',
          fail: () => Promise.reject(new Error('network down'))
        }
      ])(
        'marks unverified only the packs in the failed chunk when its request $outcome',
        async ({ fail }) => {
          installPacks(250)
          vi.mocked(mockRegistryService.getBulkNodeVersions).mockImplementation(
            (nodeVersions) =>
              isFirstChunk(nodeVersions)
                ? fail()
                : Promise.resolve(activeResponse(nodeVersions))
          )

          const { runFullConflictAnalysis } = useConflictDetection()
          const { results } = await runFullConflictAnalysis()

          expect(unknownPackIds(results)).toEqual(packIds(100))
          expect(
            mockConflictStore.setRegistryUnknownPackIds
          ).toHaveBeenCalledWith(new Set(packIds(100)))
        }
      )

      it('keeps a stored banned conflict for a pack whose lookup failed', async () => {
        installPacks(1)
        mockConflictedPackages = [
          {
            package_id: 'pack-0',
            package_name: 'pack-0',
            has_conflict: true,
            conflicts: [bannedConflict],
            is_compatible: false
          }
        ]
        vi.mocked(mockRegistryService.getBulkNodeVersions).mockResolvedValue(
          null
        )

        const { runFullConflictAnalysis } = useConflictDetection()
        await runFullConflictAnalysis()

        expect(mockConflictStore.clearConflicts).not.toHaveBeenCalled()
        expect(mockConflictStore.setConflictedPackages).toHaveBeenCalledWith([
          expect.objectContaining({
            package_id: 'pack-0',
            conflicts: [bannedConflict],
            registry_status_unknown: true
          })
        ])
      })

      it('keeps a stored compatibility conflict for a pack whose lookup failed', async () => {
        installPacks(1)
        const osConflict = {
          type: 'os' as const,
          current_value: 'Windows',
          required_value: 'Linux'
        }
        mockConflictedPackages = [
          {
            package_id: 'pack-0',
            package_name: 'pack-0',
            has_conflict: true,
            conflicts: [osConflict],
            is_compatible: false
          }
        ]
        vi.mocked(mockRegistryService.getBulkNodeVersions).mockResolvedValue(
          null
        )

        const { runFullConflictAnalysis } = useConflictDetection()
        await runFullConflictAnalysis()

        expect(mockConflictStore.setConflictedPackages).toHaveBeenCalledWith([
          expect.objectContaining({
            package_id: 'pack-0',
            conflicts: [osConflict],
            registry_status_unknown: true
          })
        ])
      })

      it('drops a stored import failure rather than carrying it over', async () => {
        installPacks(1)
        mockConflictedPackages = [
          {
            package_id: 'pack-0',
            package_name: 'pack-0',
            has_conflict: true,
            conflicts: [
              bannedConflict,
              {
                type: 'import_failed' as const,
                current_value: 'since-resolved error',
                required_value: 'since-resolved error'
              }
            ],
            is_compatible: false
          }
        ]
        vi.mocked(mockRegistryService.getBulkNodeVersions).mockResolvedValue(
          null
        )

        const { runFullConflictAnalysis } = useConflictDetection()
        await runFullConflictAnalysis()

        expect(mockConflictStore.setConflictedPackages).toHaveBeenCalledWith([
          expect.objectContaining({
            package_id: 'pack-0',
            conflicts: [bannedConflict]
          })
        ])
      })

      it.for([
        { answer: 'omits the pack', node_versions: [] },
        {
          answer: "reports the pack 'not_found'",
          node_versions: [
            {
              status: 'not_found' as const,
              identifier: { node_id: 'pack-0', version: '1.0.0' }
            }
          ]
        }
      ])(
        'leaves the plain fallback when the response $answer',
        async ({ node_versions }) => {
          installPacks(1)
          vi.mocked(mockRegistryService.getBulkNodeVersions).mockResolvedValue({
            node_versions
          })

          const { runFullConflictAnalysis } = useConflictDetection()
          const { results } = await runFullConflictAnalysis()

          expect(bulkCalls()).toHaveLength(1)
          expect(unknownPackIds(results)).toEqual([])
        }
      )

      it("marks a pack unverified when its entry comes back 'error'", async () => {
        installPacks(2)
        vi.mocked(mockRegistryService.getBulkNodeVersions).mockImplementation(
          (nodeVersions) =>
            Promise.resolve({
              node_versions: nodeVersions.map((identifier) =>
                identifier.node_id === 'pack-0'
                  ? {
                      status: 'error' as const,
                      identifier,
                      error_message: 'internal error'
                    }
                  : activeResponse([identifier]).node_versions[0]
              )
            })
        )

        const { runFullConflictAnalysis } = useConflictDetection()
        const { results } = await runFullConflictAnalysis()

        expect(bulkCalls()).toHaveLength(1)
        expect(unknownPackIds(results)).toEqual(['pack-0'])
      })

      it('does not mark packs unverified when the retry succeeds', async () => {
        installPacks(50)
        let attempts = 0
        vi.mocked(mockRegistryService.getBulkNodeVersions).mockImplementation(
          (nodeVersions) => {
            attempts += 1
            return Promise.resolve(
              attempts === 1 ? null : activeResponse(nodeVersions)
            )
          }
        )

        const { runFullConflictAnalysis } = useConflictDetection()
        const { results } = await runFullConflictAnalysis()

        expect(bulkCalls()).toHaveLength(2)
        expect(unknownPackIds(results)).toEqual([])
      })

      it('retries a chunk exactly once before marking its packs unverified', async () => {
        installPacks(50)
        vi.mocked(mockRegistryService.getBulkNodeVersions).mockResolvedValue(
          null
        )

        const { runFullConflictAnalysis } = useConflictDetection()
        const { results } = await runFullConflictAnalysis()

        expect(bulkCalls()).toHaveLength(2)
        expect(unknownPackIds(results)).toEqual(packIds(50))
      })

      it('leaves the stored conflicts untouched when the run is cancelled', async () => {
        installPacks(50)
        mockConflictedPackages = [
          {
            package_id: 'pack-0',
            package_name: 'pack-0',
            has_conflict: true,
            conflicts: [bannedConflict],
            is_compatible: false
          }
        ]

        const { runFullConflictAnalysis, cancelRequests } =
          useConflictDetection()
        vi.mocked(mockRegistryService.getBulkNodeVersions).mockImplementation(
          () => {
            cancelRequests()
            return Promise.resolve(null)
          }
        )

        const { success } = await runFullConflictAnalysis()

        expect(success).toBe(false)
        expect(bulkCalls()).toHaveLength(1)
        expect(
          mockConflictStore.setRegistryUnknownPackIds
        ).not.toHaveBeenCalled()
        expect(mockConflictStore.setConflictedPackages).not.toHaveBeenCalled()
        expect(mockConflictStore.clearConflicts).not.toHaveBeenCalled()
      })

      it('clears the unverified pack ids on a later successful run', async () => {
        installPacks(50)
        vi.mocked(mockRegistryService.getBulkNodeVersions).mockResolvedValue(
          null
        )

        const { runFullConflictAnalysis } = useConflictDetection()
        await runFullConflictAnalysis()

        expect(
          mockConflictStore.setRegistryUnknownPackIds
        ).toHaveBeenLastCalledWith(new Set(packIds(50)))

        vi.mocked(mockRegistryService.getBulkNodeVersions).mockImplementation(
          (nodeVersions) => Promise.resolve(activeResponse(nodeVersions))
        )
        await runFullConflictAnalysis()

        expect(
          mockConflictStore.setRegistryUnknownPackIds
        ).toHaveBeenLastCalledWith(new Set())
      })
    })
  })

  describe('checkNodeCompatibility status derivation', () => {
    it('flags a banned conflict for a Node with NodeStatusBanned', () => {
      const { checkNodeCompatibility } = useConflictDetection()
      const { conflicts } = checkNodeCompatibility({
        status: 'NodeStatusBanned'
      })

      expect(conflicts.map((c) => c.type)).toContain('banned')
    })

    it('flags a banned conflict for a NodeVersion with NodeVersionStatusBanned', () => {
      const { checkNodeCompatibility } = useConflictDetection()
      const { conflicts } = checkNodeCompatibility({
        status: 'NodeVersionStatusBanned'
      })

      expect(conflicts.map((c) => c.type)).toContain('banned')
    })

    it('flags a pending conflict for a NodeVersion with NodeVersionStatusPending', () => {
      const { checkNodeCompatibility } = useConflictDetection()
      const { conflicts } = checkNodeCompatibility({
        status: 'NodeVersionStatusPending'
      })

      const types = conflicts.map((c) => c.type)
      expect(types).toContain('pending')
      expect(types).not.toContain('banned')
    })

    it('forwards supported_os/supported_accelerators to the systemCompatibility checks', () => {
      const { checkNodeCompatibility } = useConflictDetection()
      checkNodeCompatibility({
        status: 'NodeVersionStatusActive',
        supported_os: ['Linux'],
        supported_accelerators: ['CUDA']
      })

      expect(checkOSCompatibility).toHaveBeenCalledWith(['Linux'], undefined)
      expect(checkAcceleratorCompatibility).toHaveBeenCalledWith(
        ['CUDA'],
        undefined
      )
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
    })
  })
})
