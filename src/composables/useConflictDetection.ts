import { computed, getCurrentInstance, onUnmounted, readonly, ref } from 'vue'

import { useConflictAcknowledgment } from '@/composables/useConflictAcknowledgment'
import config from '@/config'
import { useComfyManagerService } from '@/services/comfyManagerService'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import { useConflictDetectionStore } from '@/stores/conflictDetectionStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import type { SystemStats } from '@/types'
import type { components } from '@/types/comfyRegistryTypes'
import type {
  ConflictDetail,
  ConflictDetectionResponse,
  ConflictDetectionResult,
  ConflictDetectionSummary,
  ConflictType,
  NodePackRequirements,
  SupportedAccelerator,
  SupportedOS,
  SystemEnvironment
} from '@/types/conflictDetectionTypes'
import type { components as ManagerComponents } from '@/types/generatedManagerTypes'
import {
  cleanVersion,
  satisfiesVersion,
  checkVersionCompatibility as utilCheckVersionCompatibility
} from '@/utils/versionUtil'

/**
 * Composable for conflict detection system.
 * Error-resilient and asynchronous to avoid affecting other components.
 */
export function useConflictDetection() {
  // State management
  const isDetecting = ref(false)
  const lastDetectionTime = ref<string | null>(null)
  const detectionError = ref<string | null>(null)

  // System environment information
  const systemEnvironment = ref<SystemEnvironment | null>(null)

  // Conflict detection results
  const detectionResults = ref<ConflictDetectionResult[]>([])
  // Store merged conflicts separately for testing
  const storedMergedConflicts = ref<ConflictDetectionResult[]>([])
  const detectionSummary = ref<ConflictDetectionSummary | null>(null)

  // Registry API request cancellation
  const abortController = ref<AbortController | null>(null)

  // Acknowledgment management
  const acknowledgment = useConflictAcknowledgment()

  // Store management
  const conflictStore = useConflictDetectionStore()

  // Computed properties - use store instead of local state
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
  async function detectSystemEnvironment(): Promise<SystemEnvironment> {
    try {
      // Get system stats from store (primary source of system information)
      const systemStatsStore = useSystemStatsStore()
      await systemStatsStore.fetchSystemStats()

      // Fetch version information from backend (with error resilience)
      const [frontendVersion] = await Promise.allSettled([
        fetchFrontendVersion()
      ])

      // Extract system information from system stats
      const systemStats = systemStatsStore.systemStats
      const comfyuiVersion = systemStats?.system?.comfyui_version || 'unknown'
      const pythonVersion = systemStats?.system?.python_version || 'unknown'

      // Use system stats for OS detection (more accurate than browser detection)
      const systemOS = systemStats?.system?.os || 'unknown'

      // Extract architecture from system stats device information
      const architecture = extractArchitectureFromSystemStats(systemStats)

      // Detect GPU/accelerator information from system stats
      const acceleratorInfo = extractAcceleratorInfo(systemStats)

      // Enhanced OS detection using multiple sources
      const detectedOS = detectOSFromSystemStats(systemOS, systemStats)

      const environment: SystemEnvironment = {
        // Version information (use 'unknown' on failure)
        comfyui_version: comfyuiVersion,
        frontend_version:
          frontendVersion.status === 'fulfilled'
            ? frontendVersion.value
            : 'unknown',
        python_version: pythonVersion,

        // Platform information (from system stats)
        os: detectedOS,
        platform_details: systemOS,
        architecture: architecture,

        // GPU/accelerator information
        available_accelerators: acceleratorInfo.available,
        primary_accelerator: acceleratorInfo.primary,
        gpu_memory_mb: acceleratorInfo.memory_mb,

        // Runtime information
        node_env: import.meta.env.MODE as 'development' | 'production',
        user_agent: navigator.userAgent
      }

      systemEnvironment.value = environment
      console.log(
        '[ConflictDetection] System environment detection completed:',
        environment
      )
      return environment
    } catch (error) {
      console.warn(
        '[ConflictDetection] Error during system environment detection:',
        error
      )

      // Try to get frontend version even in fallback mode
      let frontendVersion = 'unknown'
      try {
        frontendVersion = await fetchFrontendVersion()
      } catch {
        frontendVersion = 'unknown'
      }

      // Provide basic environment information even on error
      const fallbackEnvironment: SystemEnvironment = {
        comfyui_version: 'unknown',
        frontend_version: frontendVersion,
        python_version: 'unknown',
        os: detectOSFromSystemStats(navigator.platform),
        platform_details: navigator.platform,
        architecture: getArchitecture(),
        available_accelerators: ['CPU'],
        primary_accelerator: 'CPU',
        node_env: import.meta.env.MODE as 'development' | 'production',
        user_agent: navigator.userAgent
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
  async function fetchPackageRequirements(): Promise<NodePackRequirements[]> {
    try {
      // Step 1: Get locally installed packages
      const comfyManagerService = useComfyManagerService()
      const installedNodes:
        | ManagerComponents['schemas']['InstalledPacksResponse']
        | null = await comfyManagerService.listInstalledPacks()

      if (!installedNodes) {
        console.warn(
          '[ConflictDetection] Unable to fetch installed package information'
        )
        return []
      }

      // Step 2: Get Registry service for individual API calls
      const registryService = useComfyRegistryService()

      // Step 3: Setup abort controller for request cancellation
      abortController.value = new AbortController()

      // Step 4: Fetch version-specific data in chunks to avoid overwhelming the Registry API
      //         - Each chunk processes up to 30 packages concurrently
      //         - Results are stored in versionDataMap for later use
      const entries = Object.entries(installedNodes)
      const chunkSize = 30 // 청크 크기
      const versionDataMap = new Map<
        string,
        components['schemas']['NodeVersion']
      >()

      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize)

        const fetchTasks = chunk.map(async ([packageName, nodeInfo]) => {
          const typedNodeInfo: ManagerComponents['schemas']['ManagerPackInstalled'] =
            nodeInfo
          const version = typedNodeInfo.ver || 'latest'

          try {
            const versionData = await registryService.getPackByVersion(
              packageName,
              version,
              abortController.value?.signal
            )

            if (versionData) {
              versionDataMap.set(packageName, versionData)
            }
          } catch (error) {
            console.warn(
              `[ConflictDetection] Failed to fetch version data for ${packageName}@${version}:`,
              error
            )
          }
        })

        await Promise.allSettled(fetchTasks)
      }

      // Step 5: Combine local installation data with Registry version data
      const requirements: NodePackRequirements[] = []

      for (const [packageName, nodeInfo] of Object.entries(installedNodes)) {
        const typedNodeInfo: ManagerComponents['schemas']['ManagerPackInstalled'] =
          nodeInfo
        const versionData = versionDataMap.get(packageName)

        if (versionData) {
          // Combine local installation data with version-specific Registry data
          const requirement: NodePackRequirements = {
            // Basic package info
            package_id: packageName,
            package_name: packageName, // We don't need to fetch node info separately
            installed_version: typedNodeInfo.ver || 'unknown',
            is_enabled: typedNodeInfo.enabled,

            // Version-specific compatibility data
            supported_comfyui_version: versionData.supported_comfyui_version,
            supported_comfyui_frontend_version:
              versionData.supported_comfyui_frontend_version,
            supported_os: normalizeOSValues(versionData.supported_os),
            supported_accelerators:
              versionData.supported_accelerators as SupportedAccelerator[],
            dependencies: versionData.dependencies || [],

            // Status information
            registry_status: undefined, // Node status - not critical for conflict detection
            version_status: versionData.status,
            is_banned:
              versionData.status === 'NodeVersionStatusBanned' ||
              !typedNodeInfo.enabled,
            ban_reason:
              versionData.status === 'NodeVersionStatusBanned'
                ? 'Version is banned in Registry'
                : !typedNodeInfo.enabled
                  ? 'Package is disabled locally'
                  : undefined,

            // Metadata
            registry_fetch_time: new Date().toISOString(),
            has_registry_data: true
          }

          requirements.push(requirement)
        } else {
          console.warn(
            `[ConflictDetection] No Registry data found for ${packageName}, using fallback`
          )

          // Create fallback requirement without Registry data
          const fallbackRequirement: NodePackRequirements = {
            package_id: packageName,
            package_name: packageName,
            installed_version: typedNodeInfo.ver || 'unknown',
            is_enabled: typedNodeInfo.enabled,
            is_banned: !typedNodeInfo.enabled,
            ban_reason: !typedNodeInfo.enabled
              ? 'Package is disabled locally'
              : undefined,
            registry_fetch_time: new Date().toISOString(),
            has_registry_data: false
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
  function detectPackageConflicts(
    packageReq: NodePackRequirements,
    sysEnv: SystemEnvironment
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
    if (
      packageReq.has_registry_data &&
      !isCompatibleWithAll(packageReq.supported_comfyui_version)
    ) {
      const versionConflict = checkVersionConflict(
        'comfyui_version',
        sysEnv.comfyui_version,
        packageReq.supported_comfyui_version!
      )
      if (versionConflict) conflicts.push(versionConflict)
    }

    // 2. Frontend version conflict check
    if (
      packageReq.has_registry_data &&
      !isCompatibleWithAll(packageReq.supported_comfyui_frontend_version)
    ) {
      const versionConflict = checkVersionConflict(
        'frontend_version',
        sysEnv.frontend_version,
        packageReq.supported_comfyui_frontend_version!
      )
      if (versionConflict) conflicts.push(versionConflict)
    }

    // 3. OS compatibility check
    if (
      packageReq.has_registry_data &&
      !isCompatibleWithAll(packageReq.supported_os)
    ) {
      const osConflict = checkOSConflict(packageReq.supported_os!, sysEnv.os)
      if (osConflict) conflicts.push(osConflict)
    }

    // 4. Accelerator compatibility check
    if (
      packageReq.has_registry_data &&
      !isCompatibleWithAll(packageReq.supported_accelerators)
    ) {
      const acceleratorConflict = checkAcceleratorConflict(
        packageReq.supported_accelerators!,
        sysEnv.available_accelerators
      )
      if (acceleratorConflict) conflicts.push(acceleratorConflict)
    }

    // 5. Banned package check using shared logic
    const bannedConflict = checkBannedStatus(packageReq.is_banned)
    if (bannedConflict) {
      conflicts.push(bannedConflict)
    }

    // 6. Registry data availability check using shared logic
    const securityConflict = checkSecurityStatus(packageReq.has_registry_data)
    if (securityConflict) {
      conflicts.push(securityConflict)
    }

    // Generate result
    const hasConflict = conflicts.length > 0

    return {
      package_id: packageReq.package_id,
      package_name: packageReq.package_name,
      has_conflict: hasConflict,
      conflicts,
      is_compatible: !hasConflict
    }
  }

  /**
   * Fetches Python import failure information from ComfyUI Manager.
   * Gets installed packages and checks each one for import failures.
   * @returns Promise that resolves to import failure data
   */
  async function fetchImportFailInfo(): Promise<Record<string, any>> {
    try {
      const comfyManagerService = useComfyManagerService()

      // Get installed packages first
      const installedPacks = await comfyManagerService.listInstalledPacks(
        abortController.value?.signal
      )

      if (!installedPacks) {
        console.warn('[ConflictDetection] No installed packages found')
        return {}
      }

      const importFailures: Record<string, any> = {}

      // Check each installed package for import failures
      // Process in smaller batches to avoid overwhelming the API
      const packageNames = Object.keys(installedPacks)
      const batchSize = 10

      for (let i = 0; i < packageNames.length; i += batchSize) {
        const batch = packageNames.slice(i, i + batchSize)

        const batchResults = await Promise.allSettled(
          batch.map(async (packageName) => {
            try {
              // Try to get import failure info for this package
              const failInfo = await comfyManagerService.getImportFailInfo(
                { cnr_id: packageName },
                abortController.value?.signal
              )

              if (failInfo) {
                console.log(
                  `[ConflictDetection] Import failure found for ${packageName}:`,
                  failInfo
                )
                return { packageName, failInfo }
              }
            } catch (error) {
              // If API returns 400, it means no import failure info available
              // This is normal for packages that imported successfully
              if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as any
                if (axiosError.response?.status === 400) {
                  return null // No failure info available (normal case)
                }
              }

              console.warn(
                `[ConflictDetection] Failed to check import failure for ${packageName}:`,
                error
              )
            }
            return null
          })
        )

        // Process batch results
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            const { packageName, failInfo } = result.value
            importFailures[packageName] = failInfo
          }
        })
      }

      return importFailures
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
  function detectPythonImportConflicts(
    importFailInfo: Record<string, any>
  ): ConflictDetectionResult[] {
    const results: ConflictDetectionResult[] = []

    if (!importFailInfo || typeof importFailInfo !== 'object') {
      return results
    }

    // Process import failures
    for (const [packageName, failureInfo] of Object.entries(importFailInfo)) {
      if (failureInfo && typeof failureInfo === 'object') {
        // Extract error information from Manager API response
        const errorMsg = failureInfo.msg || 'Unknown import error'
        const modulePath = failureInfo.path || ''

        // Parse error message to extract missing dependency
        const missingDependency = extractMissingDependency(errorMsg)

        const conflicts: ConflictDetail[] = [
          {
            type: 'python_dependency',
            current_value: 'missing',
            required_value: missingDependency
          }
        ]

        results.push({
          package_id: packageName,
          package_name: packageName,
          has_conflict: true,
          conflicts,
          is_compatible: false
        })

        console.warn(
          `[ConflictDetection] Python import failure detected for ${packageName}:`,
          {
            path: modulePath,
            error: errorMsg,
            missingDependency
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
  async function performConflictDetection(): Promise<ConflictDetectionResponse> {
    if (isDetecting.value) {
      console.log('[ConflictDetection] Already detecting, skipping')
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
      const sysEnv = await detectSystemEnvironment()

      // 2. Collect package requirement information
      const packageRequirements = await fetchPackageRequirements()

      // 3. Detect conflicts for each package (parallel processing)
      const conflictDetectionTasks = packageRequirements.map(
        async (packageReq) => {
          try {
            return detectPackageConflicts(packageReq, sysEnv)
          } catch (error) {
            console.warn(
              `[ConflictDetection] Failed to detect conflicts for package ${packageReq.package_name}:`,
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
      const importFailResults = detectPythonImportConflicts(importFailInfo)
      console.log(
        '[ConflictDetection] Python import failures detected:',
        importFailResults
      )

      // 5. Combine all results
      const allResults = [...packageResults, ...importFailResults]

      // 6. Generate summary information
      const summary = generateSummary(allResults, Date.now() - startTime)

      // 7. Update state
      detectionResults.value = allResults
      detectionSummary.value = summary
      lastDetectionTime.value = new Date().toISOString()

      console.log('[ConflictDetection] Conflict detection completed:', summary)

      // Store conflict results for later UI display
      // Dialog will be shown based on specific events, not on app mount
      if (allResults.some((result) => result.has_conflict)) {
        const conflictedResults = allResults.filter(
          (result) => result.has_conflict
        )

        // Merge conflicts for packages with the same name
        const mergedConflicts = mergeConflictsByPackageName(conflictedResults)

        console.log(
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

        // Check for ComfyUI version change to reset acknowledgments
        if (sysEnv.comfyui_version !== 'unknown') {
          acknowledgment.checkComfyUIVersionChange(sysEnv.comfyui_version)
        }

        // TODO: Show red dot on Help Center based on acknowledgment.shouldShowRedDot
        // TODO: Store conflict state for event-based dialog triggers

        // Use merged conflicts in response as well
        const response: ConflictDetectionResponse = {
          success: true,
          summary,
          results: mergedConflicts,
          detected_system_environment: sysEnv
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
        detected_system_environment: sysEnv
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
        summary: detectionSummary.value || getEmptySummary(),
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
   */
  async function initializeConflictDetection(): Promise<void> {
    try {
      await performConflictDetection()
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
    console.log(
      '[ConflictDetection] Checking if conflict modal should show after update...'
    )

    // Ensure conflict detection has run
    if (detectionResults.value.length === 0) {
      console.log(
        '[ConflictDetection] No detection results, running conflict detection...'
      )
      await performConflictDetection()
    }

    // Check if this is a version update scenario
    // In a real scenario, this would check actual version change
    // For now, we'll assume it's an update if we have conflicts and modal hasn't been dismissed
    const hasActualConflicts = hasConflicts.value
    const canShowModal = acknowledgment.shouldShowConflictModal.value

    console.log('[ConflictDetection] Modal check:', {
      hasConflicts: hasActualConflicts,
      canShowModal: canShowModal,
      conflictedPackagesCount: conflictedPackages.value.length
    })

    return hasActualConflicts && canShowModal
  }

  /**
   * Mark conflict modal as dismissed
   */
  function dismissConflictModal(): void {
    acknowledgment.dismissConflictModal()
  }

  /**
   * Mark red dot notification as dismissed
   */
  function dismissRedDotNotification(): void {
    acknowledgment.dismissRedDotNotification()
  }

  /**
   * Acknowledge a specific conflict
   */
  function acknowledgePackageConflict(
    packageId: string,
    conflictType: string
  ): void {
    const currentVersion = systemEnvironment.value?.comfyui_version || 'unknown'
    acknowledgment.acknowledgeConflict(packageId, conflictType, currentVersion)
  }

  /**
   * Check compatibility for a specific version of a package.
   * Used by components like PackVersionSelectorPopover.
   */
  function checkVersionCompatibility(versionData: {
    supported_os?: string[]
    supported_accelerators?: string[]
    supported_comfyui_version?: string
    supported_comfyui_frontend_version?: string
    supported_python_version?: string
    is_banned?: boolean
    has_registry_data?: boolean
  }) {
    const systemStatsStore = useSystemStatsStore()
    const systemStats = systemStatsStore.systemStats
    if (!systemStats) return { hasConflict: false, conflicts: [] }

    const conflicts: ConflictDetail[] = []

    // Check OS compatibility using centralized function
    if (versionData.supported_os && versionData.supported_os.length > 0) {
      const currentOS = systemStats.system?.os || 'unknown'
      const osConflict = checkOSConflict(
        versionData.supported_os as SupportedOS[],
        currentOS as SupportedOS
      )
      if (osConflict) {
        conflicts.push(osConflict)
      }
    }

    // Check accelerator compatibility using centralized function
    if (
      versionData.supported_accelerators &&
      versionData.supported_accelerators.length > 0
    ) {
      // Extract available accelerators from system stats
      const acceleratorInfo = extractAcceleratorInfo(systemStats)
      const availableAccelerators: SupportedAccelerator[] = []

      acceleratorInfo.available.forEach((accel) => {
        if (accel === 'CUDA') availableAccelerators.push('CUDA')
        if (accel === 'Metal') availableAccelerators.push('Metal')
        if (accel === 'CPU') availableAccelerators.push('CPU')
      })

      const acceleratorConflict = checkAcceleratorConflict(
        versionData.supported_accelerators as SupportedAccelerator[],
        availableAccelerators
      )
      if (acceleratorConflict) {
        conflicts.push(acceleratorConflict)
      }
    }

    // Check ComfyUI version compatibility
    if (versionData.supported_comfyui_version) {
      const currentComfyUIVersion = systemStats.system?.comfyui_version
      if (currentComfyUIVersion && currentComfyUIVersion !== 'unknown') {
        const versionConflict = utilCheckVersionCompatibility(
          'comfyui_version',
          currentComfyUIVersion,
          versionData.supported_comfyui_version
        )
        if (versionConflict) {
          conflicts.push(versionConflict)
        }
      }
    }

    // Check ComfyUI Frontend version compatibility
    if (versionData.supported_comfyui_frontend_version) {
      const currentFrontendVersion = config.app_version
      if (currentFrontendVersion && currentFrontendVersion !== 'unknown') {
        const versionConflict = utilCheckVersionCompatibility(
          'frontend_version',
          currentFrontendVersion,
          versionData.supported_comfyui_frontend_version
        )
        if (versionConflict) {
          conflicts.push(versionConflict)
        }
      }
    }

    // Check Python version compatibility
    if (versionData.supported_python_version) {
      const currentPythonVersion = systemStats.system?.python_version
      if (currentPythonVersion && currentPythonVersion !== 'unknown') {
        const versionConflict = utilCheckVersionCompatibility(
          'python_version',
          currentPythonVersion,
          versionData.supported_python_version
        )
        if (versionConflict) {
          conflicts.push(versionConflict)
        }
      }
    }

    // Check banned package status using shared logic
    const bannedConflict = checkBannedStatus(versionData.is_banned)
    if (bannedConflict) {
      conflicts.push(bannedConflict)
    }

    // Check security/registry data status using shared logic
    const securityConflict = checkSecurityStatus(versionData.has_registry_data)
    if (securityConflict) {
      conflicts.push(securityConflict)
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

    // Acknowledgment state
    shouldShowConflictModal: acknowledgment.shouldShowConflictModal,
    shouldShowRedDot: acknowledgment.shouldShowRedDot,
    acknowledgedPackageIds: acknowledgment.acknowledgedPackageIds,

    // Methods
    performConflictDetection,
    detectSystemEnvironment,
    initializeConflictDetection,
    cancelRequests,
    shouldShowConflictModalAfterUpdate,
    dismissConflictModal,
    dismissRedDotNotification,
    acknowledgePackageConflict,

    // Helper functions for other components
    checkVersionCompatibility
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
    const packageName = conflict.package_name

    if (mergedMap.has(packageName)) {
      // Package already exists, merge conflicts
      const existing = mergedMap.get(packageName)!

      // Combine all conflicts, avoiding duplicates
      const allConflicts = [...existing.conflicts, ...conflict.conflicts]
      const uniqueConflicts = allConflicts.filter((conflict, index, array) => {
        // Check if this conflict type already exists
        return (
          array.findIndex(
            (c) =>
              c.type === conflict.type &&
              c.current_value === conflict.current_value &&
              c.required_value === conflict.required_value
          ) === index
        )
      })

      // Update the existing entry
      mergedMap.set(packageName, {
        ...existing,
        conflicts: uniqueConflicts,
        has_conflict: uniqueConflicts.length > 0,
        is_compatible: uniqueConflicts.length === 0
      })
    } else {
      // New package, add as-is
      mergedMap.set(packageName, conflict)
    }
  })

  return Array.from(mergedMap.values())
}

/**
 * Extracts missing dependency name from Python error message.
 * @param errorMsg Error message from Python import failure
 * @returns Name of missing dependency
 */
function extractMissingDependency(errorMsg: string): string {
  // Try to extract module name from common error patterns

  // Pattern 1: "ModuleNotFoundError: No module named 'module_name'"
  const moduleNotFoundMatch = errorMsg.match(/No module named '([^']+)'/)
  if (moduleNotFoundMatch) {
    return moduleNotFoundMatch[1]
  }

  // Pattern 2: "ImportError: cannot import name 'something' from 'module_name'"
  const importErrorMatch = errorMsg.match(
    /cannot import name '[^']+' from '([^']+)'/
  )
  if (importErrorMatch) {
    return importErrorMatch[1]
  }

  // Pattern 3: "from module_name import something" in the traceback
  const fromImportMatch = errorMsg.match(/from ([a-zA-Z_][a-zA-Z0-9_]*) import/)
  if (fromImportMatch) {
    return fromImportMatch[1]
  }

  // Pattern 4: "import module_name" in the traceback
  const importMatch = errorMsg.match(/import ([a-zA-Z_][a-zA-Z0-9_]*)/)
  if (importMatch) {
    return importMatch[1]
  }

  // Fallback: return generic message
  return 'unknown dependency'
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
 * Detects system architecture from user agent.
 * Note: Browser architecture detection has limitations and may not be 100% accurate.
 * @returns Architecture string
 */
function getArchitecture(): string {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('arm64') || ua.includes('aarch64')) return 'arm64'
  if (ua.includes('arm')) return 'arm'
  if (ua.includes('x86_64') || ua.includes('x64')) return 'x64'
  if (ua.includes('x86')) return 'x86'
  return 'unknown'
}

/**
 * Normalizes OS values from Registry API to match our SupportedOS type.
 * Registry Admin guide specifies: Windows, macOS, Linux
 * @param osValues OS values from Registry API
 * @returns Normalized OS values
 */
function normalizeOSValues(osValues: string[] | undefined): SupportedOS[] {
  if (!osValues || osValues.length === 0) {
    return []
  }

  return osValues.map((os) => {
    // Map to standard Registry values (case-sensitive)
    if (os === 'Windows' || os.toLowerCase().includes('win')) {
      return 'Windows'
    }
    if (os === 'macOS' || os.toLowerCase().includes('mac') || os === 'darwin') {
      return 'macOS'
    }
    if (os === 'Linux' || os.toLowerCase().includes('linux')) {
      return 'Linux'
    }
    if (os.toLowerCase() === 'any') {
      return 'any'
    }

    // Return as-is if it matches standard format
    return os as SupportedOS
  })
}

/**
 * Detects operating system from system stats OS string and additional system information.
 * @param systemOS OS string from system stats API
 * @param systemStats Full system stats object for additional context
 * @returns Operating system type
 */
function detectOSFromSystemStats(
  systemOS: string,
  systemStats?: SystemStats | null
): SupportedOS {
  const os = systemOS.toLowerCase()

  // Handle specific OS strings (return Registry standard format)
  if (os.includes('darwin') || os.includes('mac')) return 'macOS'
  if (os.includes('linux')) return 'Linux'
  if (os.includes('win') || os === 'nt') return 'Windows'

  // Handle Python's os.name values
  if (os === 'posix') {
    // posix could be macOS or Linux, need additional detection

    // Method 1: Check for MPS device (Metal Performance Shaders = macOS)
    if (systemStats?.devices) {
      const hasMpsDevice = systemStats.devices.some(
        (device) => device.type === 'mps'
      )
      if (hasMpsDevice) {
        return 'macOS' // Registry standard format
      }
    }

    // Method 2: Check Python version string for platform hints
    if (systemStats?.system?.python_version) {
      const pythonVersion = systemStats.system.python_version.toLowerCase()
      if (pythonVersion.includes('darwin')) return 'macOS'
      if (pythonVersion.includes('linux')) return 'Linux'
    }

    // Method 3: Check user agent as fallback
    const userAgent = navigator.userAgent.toLowerCase()
    if (userAgent.includes('mac')) return 'macOS'
    if (userAgent.includes('linux')) return 'Linux'

    // Default to 'any' if we can't determine
    return 'any'
  }

  return 'any'
}

/**
 * Extracts architecture information from system stats.
 * @param systemStats System stats data from API
 * @returns Architecture string
 */
function extractArchitectureFromSystemStats(
  systemStats: SystemStats | null
): string {
  try {
    if (systemStats?.devices && systemStats.devices.length > 0) {
      // Check if we have MPS device (indicates Apple Silicon)
      const hasMpsDevice = systemStats.devices.some(
        (device) => device.type === 'mps'
      )

      if (hasMpsDevice) {
        // MPS is only available on Apple Silicon Macs
        return 'arm64'
      }

      // Check device names for architecture hints (fallback)
      for (const device of systemStats.devices) {
        if (!device?.name || typeof device.name !== 'string') {
          continue
        }

        const deviceName = device.name.toLowerCase()

        // Apple Silicon detection
        if (
          deviceName.includes('apple m1') ||
          deviceName.includes('apple m2') ||
          deviceName.includes('apple m3') ||
          deviceName.includes('apple m4')
        ) {
          return 'arm64'
        }

        // Intel/AMD detection
        if (
          deviceName.includes('intel') ||
          deviceName.includes('amd') ||
          deviceName.includes('nvidia') ||
          deviceName.includes('geforce') ||
          deviceName.includes('radeon')
        ) {
          return 'x64'
        }
      }
    }

    // Fallback to basic User-Agent detection if system stats don't provide clear info
    return getArchitecture()
  } catch (error) {
    console.warn(
      '[ConflictDetection] Failed to extract architecture from system stats:',
      error
    )
    return getArchitecture()
  }
}

/**
 * Extracts accelerator information from system stats.
 * @param systemStats System stats data from store
 * @returns Accelerator information object
 */
function extractAcceleratorInfo(systemStats: SystemStats | null): {
  available: SupportedAccelerator[]
  primary: SupportedAccelerator
  memory_mb?: number
} {
  try {
    if (systemStats?.devices && systemStats.devices.length > 0) {
      const accelerators = new Set<SupportedAccelerator>()
      let primaryDevice: SupportedAccelerator = 'CPU'
      let totalMemory = 0
      let maxDevicePriority = 0

      // Device type priority (higher = better)
      const getDevicePriority = (type: string): number => {
        switch (type.toLowerCase()) {
          case 'cuda':
            return 5
          case 'mps':
            return 4
          case 'rocm':
            return 3
          case 'xpu':
            return 2 // Intel GPU
          case 'npu':
            return 1 // Neural Processing Unit
          case 'mlu':
            return 1 // Cambricon MLU
          case 'cpu':
            return 0
          default:
            return 0
        }
      }

      // Process all devices
      for (const device of systemStats.devices) {
        const deviceType = device.type.toLowerCase()
        const priority = getDevicePriority(deviceType)

        // Map device type to SupportedAccelerator (Registry standard format)
        let acceleratorType: SupportedAccelerator = 'CPU'
        if (deviceType === 'cuda') {
          acceleratorType = 'CUDA'
        } else if (deviceType === 'mps') {
          acceleratorType = 'Metal' // MPS = Metal Performance Shaders
        } else if (deviceType === 'rocm') {
          acceleratorType = 'ROCm'
        }

        accelerators.add(acceleratorType)

        // Update primary device if this one has higher priority
        if (priority > maxDevicePriority) {
          primaryDevice = acceleratorType
          maxDevicePriority = priority
        }

        // Accumulate memory from all devices
        if (device.vram_total) {
          totalMemory += device.vram_total
        }
      }

      accelerators.add('CPU') // CPU is always available

      return {
        available: Array.from(accelerators),
        primary: primaryDevice,
        memory_mb:
          totalMemory > 0 ? Math.round(totalMemory / 1024 / 1024) : undefined
      }
    }
  } catch (error) {
    console.warn(
      '[ConflictDetection] Failed to extract GPU information:',
      error
    )
  }

  // Default values
  return {
    available: ['CPU'],
    primary: 'CPU',
    memory_mb: undefined
  }
}

/**
 * Unified version conflict check using Registry API version strings.
 * Uses shared versionUtil functions for consistent version handling.
 * @param type Type of version being checked
 * @param currentVersion Current version string
 * @param supportedVersion Supported version from Registry
 * @returns Conflict detail if conflict exists, null otherwise
 */
function checkVersionConflict(
  type: ConflictType,
  currentVersion: string,
  supportedVersion: string
): ConflictDetail | null {
  // If current version is unknown, assume compatible (no conflict)
  if (currentVersion === 'unknown') {
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
  supportedOS: SupportedOS[],
  currentOS: SupportedOS
): ConflictDetail | null {
  if (supportedOS.includes('any') || supportedOS.includes(currentOS)) {
    return null
  }

  return {
    type: 'os',
    current_value: currentOS,
    required_value: supportedOS.join(', ')
  }
}

/**
 * Checks for accelerator compatibility conflicts.
 */
function checkAcceleratorConflict(
  supportedAccelerators: SupportedAccelerator[],
  availableAccelerators: SupportedAccelerator[]
): ConflictDetail | null {
  if (
    supportedAccelerators.includes('any') ||
    supportedAccelerators.some((acc) => availableAccelerators.includes(acc))
  ) {
    return null
  }

  return {
    type: 'accelerator',
    current_value: availableAccelerators.join(', '),
    required_value: supportedAccelerators.join(', ')
  }
}

/**
 * Checks for banned package status conflicts.
 */
function checkBannedStatus(isBanned?: boolean): ConflictDetail | null {
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
 * Checks for security/registry data availability conflicts.
 */
function checkSecurityStatus(hasRegistryData?: boolean): ConflictDetail | null {
  if (hasRegistryData === false) {
    return {
      type: 'security_pending',
      current_value: 'no_registry_data',
      required_value: 'registry_data_available'
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
    python_version: 0,
    os: 0,
    accelerator: 0,
    banned: 0,
    security_pending: 0,
    python_dependency: 0
  }

  const conflictsByTypeDetails: Record<ConflictType, string[]> = {
    comfyui_version: [],
    frontend_version: [],
    python_version: [],
    os: [],
    accelerator: [],
    banned: [],
    security_pending: [],
    python_dependency: []
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
      if (conflict.type === 'security_pending') securityPendingCount++
    })
  })

  return {
    total_packages: results.length,
    compatible_packages: results.filter((r) => r.is_compatible).length,
    conflicted_packages: results.filter((r) => r.has_conflict).length,
    banned_packages: bannedCount,
    security_pending_packages: securityPendingCount,
    conflicts_by_type_details: conflictsByTypeDetails,
    last_check_timestamp: new Date().toISOString(),
    check_duration_ms: durationMs
  }
}

/**
 * Creates an empty summary for error cases.
 */
function getEmptySummary(): ConflictDetectionSummary {
  return {
    total_packages: 0,
    compatible_packages: 0,
    conflicted_packages: 0,
    banned_packages: 0,
    security_pending_packages: 0,
    conflicts_by_type_details: {
      comfyui_version: [],
      frontend_version: [],
      python_version: [],
      os: [],
      accelerator: [],
      banned: [],
      security_pending: [],
      python_dependency: []
    },
    last_check_timestamp: new Date().toISOString(),
    check_duration_ms: 0
  }
}
