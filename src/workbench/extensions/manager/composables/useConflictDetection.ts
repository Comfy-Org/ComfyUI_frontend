import { until } from '@vueuse/core'
import { uniqBy } from 'es-toolkit/compat'
import { computed, getCurrentInstance, onUnmounted, readonly, ref } from 'vue'

import config from '@/config'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type { components } from '@/types/comfyRegistryTypes'
import type {
  ConflictDetail,
  ConflictDetectionResponse,
  ConflictDetectionResult,
  ConflictDetectionSummary,
  ConflictType,
  Node,
  NodeRequirements,
  SystemEnvironment
} from '@/types/conflictDetectionTypes'
import { normalizePackId } from '@/utils/packUtils'
import {
  cleanVersion,
  satisfiesVersion,
  utilCheckVersionCompatibility
} from '@/utils/versionUtil'
import { useInstalledPacks } from '@/workbench/extensions/manager/composables/nodePack/useInstalledPacks'
import { useConflictAcknowledgment } from '@/workbench/extensions/manager/composables/useConflictAcknowledgment'
import { useComfyManagerService } from '@/workbench/extensions/manager/services/comfyManagerService'
import { useComfyManagerStore } from '@/workbench/extensions/manager/stores/comfyManagerStore'
import { useConflictDetectionStore } from '@/workbench/extensions/manager/stores/conflictDetectionStore'

/**
 * Composable for conflict detection system.
 * Error-resilient and asynchronous to avoid affecting other components.
 */
export function useConflictDetection() {
  const managerStore = useComfyManagerStore()

  const {
    startFetchInstalled,
    installedPacks,
    installedPacksWithVersions,
    isReady: installedPacksReady
  } = useInstalledPacks()

  const isDetecting = ref(false)
  const lastDetectionTime = ref<string | null>(null)
  const detectionError = ref<string | null>(null)

  const systemEnvironment = ref<SystemEnvironment | null>(null)

  const detectionResults = ref<ConflictDetectionResult[]>([])
  // Store merged conflicts separately for testing
  const storedMergedConflicts = ref<ConflictDetectionResult[]>([])
  const detectionSummary = ref<ConflictDetectionSummary | null>(null)

  // Registry API request cancellation
  const abortController = ref<AbortController | null>(null)

  const acknowledgment = useConflictAcknowledgment()

  const conflictStore = useConflictDetectionStore()

  const hasConflicts = computed(() => conflictStore.hasConflicts)
  const conflictedPackages = computed(() => {
    return conflictStore.conflictedPackages
  })

  const bannedPackages = computed(() => conflictStore.bannedPackages)
  const securityPendingPackages = computed(
    () => conflictStore.securityPendingPackages
  )

  /**
   * Collects current system environment information.
   * Continues with default values even if errors occur.
   * @returns Promise that resolves to system environment information
   */
  async function collectSystemEnvironment(): Promise<SystemEnvironment> {
    try {
      // Get system stats from store (primary source of system information)
      // Wait for systemStats to be initialized if not already
      const { systemStats, isInitialized: systemStatsInitialized } =
        useSystemStatsStore()
      await until(systemStatsInitialized)

      const frontendVersion = await fetchFrontendVersion()

      const environment: SystemEnvironment = {
        comfyui_version: systemStats?.system.comfyui_version ?? '',
        frontend_version: frontendVersion,
        os: systemStats?.system.os ?? '',
        accelerator: systemStats?.devices[0].type ?? ''
      }

      systemEnvironment.value = environment
      console.debug(
        '[ConflictDetection] System environment detection completed:',
        environment
      )
      return environment
    } catch (error) {
      const fallbackEnvironment: SystemEnvironment = {
        comfyui_version: undefined,
        frontend_version: undefined,
        os: undefined,
        accelerator: undefined
      }
      systemEnvironment.value = fallbackEnvironment
      return fallbackEnvironment
    }
  }

  /**
   * Fetches requirement information for installed packages using Registry Store.
   *
   * This function combines local installation data with Registry API compatibility metadata
   * using the established store layer pattern with caching and batch requests.
   *
   * Process
   * 1. Get locally installed packages
   * 2. Batch fetch Registry data using store layer
   * 3. Combine local + Registry data
   * 4. Extract compatibility requirements
   *
   * @returns Promise that resolves to array of node pack requirements
   */
  async function buildNodeRequirements(): Promise<NodeRequirements[]> {
    try {
      // Step 1: Use installed packs composable instead of direct API calls
      await startFetchInstalled() // Ensure data is loaded

      if (
        !installedPacksReady.value ||
        !installedPacks.value ||
        installedPacks.value.length === 0
      ) {
        console.warn(
          '[ConflictDetection] No installed packages available from useInstalledPacks'
        )
        return []
      }

      // Step 2: Get Registry service for bulk API calls
      const registryService = useComfyRegistryService()

      // Step 3: Setup abort controller for request cancellation
      abortController.value = new AbortController()

      // Step 4: Use bulk API to fetch all version data in a single request
      const versionDataMap = new Map<
        string,
        components['schemas']['NodeVersion']
      >()

      // Prepare bulk request with actual installed versions from Manager API
      const nodeVersions = installedPacksWithVersions.value.map((pack) => ({
        node_id: pack.id,
        version: pack.version
      }))

      if (nodeVersions.length > 0) {
        try {
          const bulkResponse = await registryService.getBulkNodeVersions(
            nodeVersions,
            abortController.value?.signal
          )

          if (bulkResponse && bulkResponse.node_versions?.length > 0) {
            // Process bulk response
            bulkResponse.node_versions.forEach((result) => {
              if (result.status === 'success' && result.node_version) {
                versionDataMap.set(
                  result.identifier.node_id,
                  result.node_version
                )
              } else if (result.status === 'error') {
                console.warn(
                  `[ConflictDetection] Failed to fetch version data for ${result.identifier.node_id}@${result.identifier.version}:`,
                  result.error_message
                )
              }
            })
          }
        } catch (error) {
          console.warn(
            '[ConflictDetection] Failed to fetch bulk version data:',
            error
          )
        }
      }

      // Step 5: Combine local installation data with Registry version data
      const requirements: NodeRequirements[] = []

      // IMPORTANT: Use installedPacksWithVersions to check ALL installed packages
      // not just the ones that exist in Registry (installedPacks)
      for (const installedPackVersion of installedPacksWithVersions.value) {
        const versionData = versionDataMap.get(installedPackVersion.id)
        const isEnabled = managerStore.isPackEnabled(installedPackVersion.id)

        // Find the pack info from Registry if available
        const packInfo = installedPacks.value.find(
          (p) => p.id === installedPackVersion.id
        )

        if (versionData) {
          // Combine local installation data with version-specific Registry data
          const requirement: NodeRequirements = {
            // Basic package info
            id: installedPackVersion.id,
            name: packInfo?.name || installedPackVersion.id,
            installed_version: installedPackVersion.version,
            is_enabled: isEnabled,

            // Version-specific compatibility data
            supported_comfyui_version: versionData.supported_comfyui_version,
            supported_comfyui_frontend_version:
              versionData.supported_comfyui_frontend_version,
            supported_os: normalizeOSValues(versionData.supported_os),
            supported_accelerators: versionData.supported_accelerators,

            // Status information
            version_status: versionData.status,
            is_banned: versionData.status === 'NodeVersionStatusBanned',
            is_pending: versionData.status === 'NodeVersionStatusPending'
          }

          requirements.push(requirement)
        } else {
          console.warn(
            `[ConflictDetection] No Registry data found for ${installedPackVersion.id}, using fallback`
          )

          // Create fallback requirement without Registry data
          const fallbackRequirement: NodeRequirements = {
            id: installedPackVersion.id,
            name: packInfo?.name || installedPackVersion.id,
            installed_version: installedPackVersion.version,
            is_enabled: isEnabled,
            is_banned: false,
            is_pending: false
          }

          requirements.push(fallbackRequirement)
        }
      }

      return requirements
    } catch (error) {
      console.warn(
        '[ConflictDetection] Failed to fetch package requirements:',
        error
      )
      return []
    }
  }

  /**
   * Detects conflicts for an individual package using Registry API data.
   *
   * @param packageReq Package requirements from Registry
   * @param sysEnv Current system environment
   * @returns Conflict detection result for the package
   */
  function analyzePackageConflicts(
    packageReq: NodeRequirements,
    systemEnvInfo: SystemEnvironment
  ): ConflictDetectionResult {
    const conflicts: ConflictDetail[] = []

    // Helper function to check if a value indicates "compatible with all"
    const isCompatibleWithAll = (value: any): boolean => {
      if (value === null || value === undefined) return true
      if (typeof value === 'string' && value.trim() === '') return true
      if (Array.isArray(value) && value.length === 0) return true
      return false
    }

    // 1. ComfyUI version conflict check
    if (!isCompatibleWithAll(packageReq.supported_comfyui_version)) {
      const versionConflict = checkVersionConflict(
        'comfyui_version',
        systemEnvInfo.comfyui_version,
        packageReq.supported_comfyui_version!
      )
      if (versionConflict) conflicts.push(versionConflict)
    }

    // 2. Frontend version conflict check
    if (!isCompatibleWithAll(packageReq.supported_comfyui_frontend_version)) {
      const versionConflict = checkVersionConflict(
        'frontend_version',
        systemEnvInfo.frontend_version,
        packageReq.supported_comfyui_frontend_version!
      )
      if (versionConflict) conflicts.push(versionConflict)
    }

    // 3. OS compatibility check
    if (!isCompatibleWithAll(packageReq.supported_os)) {
      const osConflict = checkOSConflict(
        packageReq.supported_os!,
        systemEnvInfo.os
      )
      if (osConflict) conflicts.push(osConflict)
    }

    // 4. Accelerator compatibility check
    if (!isCompatibleWithAll(packageReq.supported_accelerators)) {
      const acceleratorConflict = checkAcceleratorConflict(
        packageReq.supported_accelerators!,
        systemEnvInfo.accelerator
      )
      if (acceleratorConflict) conflicts.push(acceleratorConflict)
    }

    // 5. Banned package check using shared logic
    const bannedConflict = createBannedConflict(packageReq.is_banned)
    if (bannedConflict) {
      conflicts.push(bannedConflict)
    }

    // 6. Registry data availability check using shared logic
    const pendingConflict = createPendingConflict(packageReq.is_pending)
    if (pendingConflict) {
      conflicts.push(pendingConflict)
    }

    // Generate result
    const hasConflict = conflicts.length > 0

    return {
      package_id: packageReq.id ?? '',
      package_name: packageReq.name ?? '',
      has_conflict: hasConflict,
      conflicts,
      is_compatible: !hasConflict
    }
  }

  /**
   * Fetches Python import failure information from ComfyUI Manager.
   * Gets installed packages and checks each one for import failures using bulk API.
   * @returns Promise that resolves to import failure data
   */
  async function fetchImportFailInfo(): Promise<Record<string, any>> {
    try {
      const comfyManagerService = useComfyManagerService()

      // Use installedPacksWithVersions to match what versions bulk API uses
      // This ensures both APIs check the same set of packages
      if (
        !installedPacksWithVersions.value ||
        installedPacksWithVersions.value.length === 0
      ) {
        console.warn(
          '[ConflictDetection] No installed packages available for import failure check'
        )
        return {}
      }

      const packageIds = installedPacksWithVersions.value.map((pack) => pack.id)

      // Use bulk API to get import failure info for all packages at once
      const bulkResult = await comfyManagerService.getImportFailInfoBulk(
        { cnr_ids: packageIds },
        abortController.value?.signal
      )

      if (bulkResult) {
        // Filter out null values (packages without import failures)
        const importFailures: Record<string, any> = {}

        Object.entries(bulkResult).forEach(([packageId, failInfo]) => {
          if (failInfo !== null) {
            importFailures[packageId] = failInfo
            console.debug(
              `[ConflictDetection] Import failure found for ${packageId}:`,
              failInfo
            )
          }
        })

        return importFailures
      }

      return {}
    } catch (error) {
      console.warn(
        '[ConflictDetection] Failed to fetch import failure information:',
        error
      )
      return {}
    }
  }

  /**
   * Detects runtime conflicts from Python import failures.
   * @param importFailInfo Import failure data from Manager API
   * @returns Array of conflict detection results for failed imports
   */
  function detectImportFailConflicts(
    importFailInfo: Record<string, { msg: string; name: string; path: string }>
  ): ConflictDetectionResult[] {
    const results: ConflictDetectionResult[] = []
    if (!importFailInfo || typeof importFailInfo !== 'object') {
      return results
    }

    // Process import failures
    for (const [packageId, failureInfo] of Object.entries(importFailInfo)) {
      if (failureInfo && typeof failureInfo === 'object') {
        // Extract error information from Manager API response
        const errorMsg = failureInfo.msg || 'Unknown import error'
        const modulePath = failureInfo.path || ''

        results.push({
          package_id: packageId,
          package_name: packageId,
          has_conflict: true,
          conflicts: [
            {
              type: 'import_failed',
              current_value: 'installed',
              required_value: failureInfo.msg
            }
          ],
          is_compatible: false
        })

        console.warn(
          `[ConflictDetection] Python import failure detected for ${packageId}:`,
          {
            path: modulePath,
            error: errorMsg
          }
        )
      }
    }

    return results
  }

  /**
   * Performs complete conflict detection.
   * @returns Promise that resolves to conflict detection response
   */
  async function runFullConflictAnalysis(): Promise<ConflictDetectionResponse> {
    if (isDetecting.value) {
      console.debug('[ConflictDetection] Already detecting, skipping')
      return {
        success: false,
        error_message: 'Already detecting conflicts',
        summary: detectionSummary.value!,
        results: detectionResults.value
      }
    }

    isDetecting.value = true
    detectionError.value = null
    const startTime = Date.now()

    try {
      // 1. Collect system environment information
      const systemEnvInfo = await collectSystemEnvironment()

      // 2. Collect installed node requirement information
      const installedNodeRequirements = await buildNodeRequirements()

      // 3. Detect conflicts for each package (parallel processing)
      const conflictDetectionTasks = installedNodeRequirements.map(
        async (packageReq) => {
          try {
            return analyzePackageConflicts(packageReq, systemEnvInfo)
          } catch (error) {
            console.warn(
              `[ConflictDetection] Failed to detect conflicts for package ${packageReq.name}:`,
              error
            )
            // Return null for failed packages, will be filtered out
            return null
          }
        }
      )

      const conflictResults = await Promise.allSettled(conflictDetectionTasks)
      const packageResults: ConflictDetectionResult[] = conflictResults
        .map((result) => (result.status === 'fulfilled' ? result.value : null))
        .filter((result): result is ConflictDetectionResult => result !== null)

      // 4. Detect Python import failures
      const importFailInfo = await fetchImportFailInfo()
      const importFailResults = detectImportFailConflicts(importFailInfo)

      // 5. Combine all results
      const allResults = [...packageResults, ...importFailResults]

      // 6. Generate summary information
      const summary = generateSummary(allResults, Date.now() - startTime)

      // 7. Update state
      detectionResults.value = allResults
      detectionSummary.value = summary
      lastDetectionTime.value = new Date().toISOString()

      console.debug(
        '[ConflictDetection] Conflict detection completed:',
        summary
      )

      // Store conflict results for later UI display
      // Dialog will be shown based on specific events, not on app mount
      if (allResults.some((result) => result.has_conflict)) {
        const conflictedResults = allResults.filter(
          (result) => result.has_conflict
        )

        // Merge conflicts for packages with the same name
        const mergedConflicts = mergeConflictsByPackageName(conflictedResults)

        console.debug(
          '[ConflictDetection] Conflicts detected (stored for UI):',
          mergedConflicts
        )

        // Store merged conflicts in Pinia store for UI usage
        conflictStore.setConflictedPackages(mergedConflicts)

        // Also update local state for backward compatibility
        detectionResults.value.splice(
          0,
          detectionResults.value.length,
          ...mergedConflicts
        )
        storedMergedConflicts.value = [...mergedConflicts]

        // Use merged conflicts in response as well
        const response: ConflictDetectionResponse = {
          success: true,
          summary,
          results: mergedConflicts,
          detected_system_environment: systemEnvInfo
        }
        return response
      } else {
        // No conflicts detected, clear the results
        conflictStore.clearConflicts()
        detectionResults.value = []
      }

      const response: ConflictDetectionResponse = {
        success: true,
        summary,
        results: allResults,
        detected_system_environment: systemEnvInfo
      }

      return response
    } catch (error) {
      console.error(
        '[ConflictDetection] Error during conflict detection:',
        error
      )
      detectionError.value =
        error instanceof Error ? error.message : String(error)

      return {
        success: false,
        error_message: detectionError.value,
        summary: detectionSummary.value || generateEmptySummary(),
        results: []
      }
    } finally {
      isDetecting.value = false
      // Clear abort controller to prevent memory leaks
      if (abortController.value) {
        abortController.value = null
      }
    }
  }

  /**
   * Error-resilient initialization (called on app mount).
   * Async function that doesn't block UI setup.
   * Ensures proper order: system_stats -> manager state -> installed -> versions bulk -> import_fail_info_bulk
   */
  async function initializeConflictDetection(): Promise<void> {
    try {
      // Check if manager is new Manager before proceeding
      const { useManagerState } = await import(
        '@/workbench/extensions/manager/composables/useManagerState'
      )
      const managerState = useManagerState()

      if (!managerState.isNewManagerUI.value) {
        console.debug(
          '[ConflictDetection] Manager is not new Manager, skipping conflict detection'
        )
        return
      }

      // Manager is new Manager, perform conflict detection
      // The useInstalledPacks will handle fetching installed list if needed
      await runFullConflictAnalysis()
    } catch (error) {
      console.warn(
        '[ConflictDetection] Error during initialization (ignored):',
        error
      )
      // Errors do not affect other parts of the app
    }
  }

  // Cleanup function for request cancellation
  function cancelRequests(): void {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
  }

  // Auto-cleanup on component unmount
  // Only register lifecycle hooks if we're in a Vue component context
  const instance = getCurrentInstance()
  if (instance) {
    onUnmounted(() => {
      cancelRequests()
    })
  }

  // Helper functions (implementations at the bottom of the file)

  /**
   * Check if conflicts should trigger modal display after "What's New" dismissal
   */
  async function shouldShowConflictModalAfterUpdate(): Promise<boolean> {
    console.debug(
      '[ConflictDetection] Checking if conflict modal should show after update...'
    )

    // Ensure conflict detection has run
    if (detectionResults.value.length === 0) {
      console.debug(
        '[ConflictDetection] No detection results, running conflict detection...'
      )
      await runFullConflictAnalysis()
    }

    // Check if this is a version update scenario
    // In a real scenario, this would check actual version change
    // For now, we'll assume it's an update if we have conflicts and modal hasn't been dismissed
    const hasActualConflicts = hasConflicts.value
    const canShowModal = acknowledgment.shouldShowConflictModal.value

    console.debug('[ConflictDetection] Modal check:', {
      hasConflicts: hasActualConflicts,
      canShowModal: canShowModal,
      conflictedPackagesCount: conflictedPackages.value.length
    })

    return hasActualConflicts && canShowModal
  }

  /**
   * Check compatibility for a node.
   * Used by components like PackVersionSelectorPopover.
   */
  async function checkNodeCompatibility(
    node: Node | components['schemas']['NodeVersion']
  ) {
    const systemStatsStore = useSystemStatsStore()
    const systemStats = systemStatsStore.systemStats
    if (!systemStats) return { hasConflict: false, conflicts: [] }

    const conflicts: ConflictDetail[] = []

    // Check OS compatibility using centralized function
    const currentOS = systemStats.system?.os
    const OSConflict = checkOSConflict(node.supported_os, currentOS)
    if (OSConflict) {
      conflicts.push(OSConflict)
    }

    // Check Accelerator compatibility using centralized function
    const currentAccelerator = systemStats.devices?.[0].type
    const acceleratorConflict = checkAcceleratorConflict(
      node.supported_accelerators,
      currentAccelerator
    )
    if (acceleratorConflict) {
      conflicts.push(acceleratorConflict)
    }

    // Check ComfyUI version compatibility
    const currentComfyUIVersion = systemStats.system?.comfyui_version
    const comfyUIVersionConflict = utilCheckVersionCompatibility(
      'comfyui_version',
      currentComfyUIVersion,
      node.supported_comfyui_version
    )
    if (comfyUIVersionConflict) {
      conflicts.push(comfyUIVersionConflict)
    }

    // Check ComfyUI Frontend version compatibility
    const currentFrontendVersion = await fetchFrontendVersion()
    const frontendVersionConflict = utilCheckVersionCompatibility(
      'frontend_version',
      currentFrontendVersion,
      node.supported_comfyui_frontend_version
    )
    if (frontendVersionConflict) {
      conflicts.push(frontendVersionConflict)
    }

    // Check banned package status using shared logic
    const bannedConflict = createBannedConflict(
      node.status === 'NodeStatusBanned' ||
        node.status === 'NodeVersionStatusBanned'
    )
    if (bannedConflict) {
      conflicts.push(bannedConflict)
    }

    // Check pending status using shared logic
    const pendingConflict = createPendingConflict(
      node.status === 'NodeVersionStatusPending'
    )
    if (pendingConflict) {
      conflicts.push(pendingConflict)
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    }
  }

  return {
    // State
    isDetecting: readonly(isDetecting),
    lastDetectionTime: readonly(lastDetectionTime),
    detectionError: readonly(detectionError),
    systemEnvironment: readonly(systemEnvironment),
    detectionResults: readonly(detectionResults),
    detectionSummary: readonly(detectionSummary),

    // Computed
    hasConflicts,
    conflictedPackages,
    bannedPackages,
    securityPendingPackages,

    // Methods
    runFullConflictAnalysis,
    collectSystemEnvironment,
    initializeConflictDetection,
    cancelRequests,
    shouldShowConflictModalAfterUpdate,

    // Helper functions for other components
    checkNodeCompatibility
  }
}

// Helper Functions Implementation

/**
 * Merges conflict results for packages with the same name.
 * Combines all conflicts from different detection sources (registry, python, extension)
 * into a single result per package name.
 * @param conflicts Array of conflict detection results
 * @returns Array of merged conflict detection results
 */
function mergeConflictsByPackageName(
  conflicts: ConflictDetectionResult[]
): ConflictDetectionResult[] {
  const mergedMap = new Map<string, ConflictDetectionResult>()

  conflicts.forEach((conflict) => {
    // Normalize package name by removing version suffix (@1_0_3) for consistent merging
    const normalizedPackageName = normalizePackId(conflict.package_name)

    if (mergedMap.has(normalizedPackageName)) {
      // Package already exists, merge conflicts
      const existing = mergedMap.get(normalizedPackageName)!

      // Combine all conflicts, avoiding duplicates using es-toolkit uniqBy for O(n) performance
      const allConflicts = [...existing.conflicts, ...conflict.conflicts]
      const uniqueConflicts = uniqBy(
        allConflicts,
        (conflict) =>
          `${conflict.type}|${conflict.current_value}|${conflict.required_value}`
      )

      // Update the existing entry with normalized package name
      mergedMap.set(normalizedPackageName, {
        ...existing,
        package_name: normalizedPackageName,
        conflicts: uniqueConflicts,
        has_conflict: uniqueConflicts.length > 0,
        is_compatible: uniqueConflicts.length === 0
      })
    } else {
      // New package, add with normalized package name
      mergedMap.set(normalizedPackageName, {
        ...conflict,
        package_name: normalizedPackageName
      })
    }
  })

  return Array.from(mergedMap.values())
}

/**
 * Fetches frontend version from config.
 * @returns Promise that resolves to frontend version string
 */
async function fetchFrontendVersion(): Promise<string> {
  try {
    // Get frontend version from vite build-time constant or fallback to config
    return config.app_version || import.meta.env.VITE_APP_VERSION || 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Normalizes OS values from the Registry API to match our SupportedOS type.
 *
 * Rules:
 * - Registry Admin guide specifies: Windows, macOS, Linux
 * - null, undefined, or an empty array → treated as "supports all OS"
 * - ['OS Independent'] → treated as "supports all OS"
 * - Otherwise, map each string to a standard OS value
 *
 * @param osValues OS values from the Registry API
 * @returns Normalized OS values
 */
function normalizeOSValues(
  osValues: string[] | null | undefined
): Node['supported_os'] {
  // Default set meaning "supports all OS"
  const allOS: Node['supported_os'] = ['Windows', 'macOS', 'Linux']

  // null, undefined, or empty array → all OS
  if (!osValues || osValues.length === 0) {
    return allOS
  }

  // If the array contains "OS Independent" → all OS
  if (osValues.some((os) => os.toLowerCase() === 'os independent')) {
    return allOS
  }

  // Map each value to standardized OS names
  return osValues.flatMap((os) => {
    const lower = os.toLowerCase()
    if (os === 'Windows' || lower.includes('win')) return ['Windows']
    if (os === 'macOS' || lower.includes('mac') || os === 'darwin')
      return ['macOS']
    if (os === 'Linux' || lower.includes('linux')) return ['Linux']
    // Ignore anything unrecognized
    return []
  })
}

/**
 * Detects operating system from system stats OS string.
 * @param systemOS OS string from system stats API
 * @returns Operating system type
 */
// TODO: move to type file
type OS_TYPE = 'Windows' | 'Linux' | 'MacOS' | 'unknown'

function mapSystemOSToRegistry(systemOS?: string): OS_TYPE {
  const os = systemOS?.toLowerCase()

  if (os?.includes('win')) return 'Windows'
  if (os?.includes('linux')) return 'Linux'
  if (os?.includes('darwin')) return 'MacOS'

  return 'unknown'
}

/**
 * Extracts accelerator information from system stats.
 * @param systemStats System stats data from store
 * @returns Accelerator information object
 */
function mapDeviceTypeToAccelerator(systemDeviceType?: string): string {
  const deviceType = systemDeviceType?.toLowerCase()

  switch (deviceType) {
    case 'cuda':
      return 'CUDA'
    case 'mps':
      return 'Metal'
    case 'rocm':
      return 'ROCm'
    default:
      return 'CPU'
  }
}

/**
 * Unified version conflict check using Registry API version strings.
 * Uses shared versionUtil functions for consistent version handling.
 * @param type Type of version being checked
 * @param currentVersion Current version
 * @param supportedVersion Supported version from Registry
 * @returns Conflict detail if conflict exists, null otherwise
 */
function checkVersionConflict(
  type: ConflictType,
  currentVersion?: string,
  supportedVersion?: string
): ConflictDetail | null {
  // If current version is undefined, assume compatible (no conflict)
  if (!currentVersion) {
    return null
  }

  // If Registry doesn't specify version requirements, assume compatible
  if (!supportedVersion || supportedVersion.trim() === '') {
    return null
  }

  try {
    // Clean the current version using shared utility
    const cleanCurrent = cleanVersion(currentVersion)

    // Check version compatibility using shared utility
    const isCompatible = satisfiesVersion(cleanCurrent, supportedVersion)

    if (!isCompatible) {
      return {
        type,
        current_value: currentVersion,
        required_value: supportedVersion
      }
    }

    return null
  } catch (error) {
    console.warn(
      `[ConflictDetection] Failed to parse version requirement: ${supportedVersion}`,
      error
    )
    return {
      type,
      current_value: currentVersion,
      required_value: supportedVersion
    }
  }
}

/**
 * Checks for OS compatibility conflicts.
 */
function checkOSConflict(
  supportedOS: Node['supported_os'],
  currentOS?: string
): ConflictDetail | null {
  const currentOsBySupportOS = mapSystemOSToRegistry(currentOS)
  const hasOSConflict =
    currentOS && !supportedOS?.includes(currentOsBySupportOS)
  if (hasOSConflict) {
    return {
      type: 'os',
      current_value: currentOsBySupportOS,
      required_value: supportedOS ? supportedOS?.join(', ') : ''
    }
  }

  return null
}

/**
 * Checks for accelerator compatibility conflicts.
 */
function checkAcceleratorConflict(
  supportedAccelerators: Node['supported_accelerators'],
  currentAccelerator?: string
): ConflictDetail | null {
  const currentAcceleratorByAccelerator =
    mapDeviceTypeToAccelerator(currentAccelerator)
  const hasAcceleratorConflict =
    currentAccelerator &&
    !supportedAccelerators?.includes(currentAcceleratorByAccelerator)
  if (hasAcceleratorConflict) {
    return {
      type: 'accelerator',
      current_value: currentAcceleratorByAccelerator,
      required_value: supportedAccelerators
        ? supportedAccelerators.join(', ')
        : ''
    }
  }
  return null
}

/**
 * Checks for banned package status conflicts.
 */
function createBannedConflict(isBanned?: boolean): ConflictDetail | null {
  if (isBanned === true) {
    return {
      type: 'banned',
      current_value: 'installed',
      required_value: 'not_banned'
    }
  }
  return null
}

/**
 * Checks for pending package status conflicts.
 */
function createPendingConflict(isPending?: boolean): ConflictDetail | null {
  if (isPending === true) {
    return {
      type: 'pending',
      current_value: 'installed',
      required_value: 'not_pending'
    }
  }
  return null
}

/**
 * Generates summary of conflict detection results.
 */
function generateSummary(
  results: ConflictDetectionResult[],
  durationMs: number
): ConflictDetectionSummary {
  const conflictsByType: Record<ConflictType, number> = {
    comfyui_version: 0,
    frontend_version: 0,
    import_failed: 0,
    os: 0,
    accelerator: 0,
    banned: 0,
    pending: 0
  }

  const conflictsByTypeDetails: Record<ConflictType, string[]> = {
    comfyui_version: [],
    frontend_version: [],
    import_failed: [],
    os: [],
    accelerator: [],
    banned: [],
    pending: []
  }

  let bannedCount = 0
  let securityPendingCount = 0

  results.forEach((result) => {
    result.conflicts.forEach((conflict) => {
      conflictsByType[conflict.type]++

      if (!conflictsByTypeDetails[conflict.type].includes(result.package_id)) {
        conflictsByTypeDetails[conflict.type].push(result.package_id)
      }

      if (conflict.type === 'banned') bannedCount++
      if (conflict.type === 'pending') securityPendingCount++
    })
  })

  return {
    total_packages: results.length,
    compatible_packages: results.filter((r) => r.is_compatible).length,
    conflicted_packages: results.filter((r) => r.has_conflict).length,
    banned_packages: bannedCount,
    pending_packages: securityPendingCount,
    conflicts_by_type_details: conflictsByTypeDetails,
    last_check_timestamp: new Date().toISOString(),
    check_duration_ms: durationMs
  }
}

/**
 * Creates an empty summary for error cases.
 */
function generateEmptySummary(): ConflictDetectionSummary {
  return {
    total_packages: 0,
    compatible_packages: 0,
    conflicted_packages: 0,
    banned_packages: 0,
    pending_packages: 0,
    conflicts_by_type_details: {
      comfyui_version: [],
      frontend_version: [],
      import_failed: [],
      os: [],
      accelerator: [],
      banned: [],
      pending: []
    },
    last_check_timestamp: new Date().toISOString(),
    check_duration_ms: 0
  }
}
