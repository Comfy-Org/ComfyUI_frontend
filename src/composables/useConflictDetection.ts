import { computed, getCurrentInstance, onUnmounted, readonly, ref } from 'vue'

import config from '@/config'
import { useComfyManagerService } from '@/services/comfyManagerService'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
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
  RecommendedAction,
  SupportedAccelerator,
  SupportedOS,
  SystemEnvironment
} from '@/types/conflictDetectionTypes'
import type { components as ManagerComponents } from '@/types/generatedManagerTypes'

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
  const detectionSummary = ref<ConflictDetectionSummary | null>(null)

  // Registry API request cancellation
  const abortController = ref<AbortController | null>(null)

  // Computed properties
  const hasConflicts = computed(() =>
    detectionResults.value.some((result) => result.has_conflict)
  )

  const conflictedPackages = computed(() =>
    detectionResults.value.filter((result) => result.has_conflict)
  )

  const bannedPackages = computed(() =>
    detectionResults.value.filter((result) =>
      result.conflicts.some((conflict) => conflict.type === 'banned')
    )
  )

  const securityPendingPackages = computed(() =>
    detectionResults.value.filter((result) =>
      result.conflicts.some((conflict) => conflict.type === 'security_pending')
    )
  )

  const criticalConflicts = computed(() =>
    detectionResults.value.flatMap((result) =>
      result.conflicts.filter((conflict) => conflict.severity === 'error')
    )
  )

  /**
   * Collects current system environment information.
   * Continues with default values even if errors occur.
   * @returns Promise that resolves to system environment information
   */
  async function detectSystemEnvironment(): Promise<SystemEnvironment> {
    console.log('[ConflictDetection] Starting system environment detection...')

    try {
      // Information directly available from the browser
      const browserInfo = {
        platform_details: navigator.platform,
        architecture: getArchitecture(),
        user_agent: navigator.userAgent,
        node_env: import.meta.env.MODE as 'development' | 'production'
      }

      // Get system stats from store (with error resilience)
      const systemStatsStore = useSystemStatsStore()
      await systemStatsStore.fetchSystemStats()

      // Fetch version information from backend (with error resilience)
      const [frontendVersion] = await Promise.allSettled([
        fetchFrontendVersion()
      ])

      // Extract system information from store or use fallback
      const systemStats = systemStatsStore.systemStats
      const comfyuiVersion = systemStats?.system?.comfyui_version || 'unknown'
      const pythonVersion = systemStats?.system?.python_version || 'unknown'

      // Detect GPU/accelerator information from system stats
      const acceleratorInfo = extractAcceleratorInfo(systemStats)

      const environment: SystemEnvironment = {
        // Version information (use 'unknown' on failure)
        comfyui_version: comfyuiVersion,
        frontend_version:
          frontendVersion.status === 'fulfilled'
            ? frontendVersion.value
            : 'unknown',
        python_version: pythonVersion,

        // Platform information
        os: detectOS(browserInfo.platform_details),
        platform_details: browserInfo.platform_details,
        architecture: browserInfo.architecture,

        // GPU/accelerator information
        available_accelerators: acceleratorInfo.available,
        primary_accelerator: acceleratorInfo.primary,
        gpu_memory_mb: acceleratorInfo.memory_mb,

        // Runtime information
        node_env: browserInfo.node_env,
        user_agent: browserInfo.user_agent
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
        os: detectOS(navigator.platform),
        platform_details: navigator.platform,
        architecture: getArchitecture(),
        available_accelerators: ['cpu'],
        primary_accelerator: 'cpu',
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
      console.log(
        '[ConflictDetection] Fetching package requirements from Registry Store...'
      )

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

      const packageIds = Object.keys(installedNodes)
      console.log('[ConflictDetection] Found installed packages:', packageIds)

      // Step 2: Get Registry store with caching support
      const registryStore = useComfyRegistryStore()

      // Step 3: Setup abort controller for request cancellation
      abortController.value = new AbortController()

      // Step 4: Batch fetch Registry data for better performance
      console.log(
        '[ConflictDetection] Batch fetching Registry data for packages...'
      )

      const registryPacks: components['schemas']['Node'][] =
        await registryStore.getPacksByIds.call(packageIds)

      // Step 5: Create a map for quick lookup
      const registryMap = new Map<string, components['schemas']['Node']>()
      registryPacks.forEach((pack) => {
        if (pack?.id) {
          registryMap.set(pack.id, pack)
        }
      })

      // Step 6: Combine local installation data with Registry data
      const requirements: NodePackRequirements[] = []

      for (const [packageName, nodeInfo] of Object.entries(installedNodes)) {
        const typedNodeInfo: ManagerComponents['schemas']['ManagerPackInstalled'] =
          nodeInfo
        const registryData = registryMap.get(packageName)

        if (registryData) {
          console.log(
            `[ConflictDetection] Processing ${packageName} with Registry data`
          )

          // Combine local installation data with Registry data
          const requirement: NodePackRequirements = {
            // Basic package info
            package_id: packageName,
            package_name: registryData.name || packageName,
            installed_version: typedNodeInfo.ver || 'unknown',
            is_enabled: typedNodeInfo.enabled,

            // Registry compatibility data
            supported_comfyui_version: registryData.supported_comfyui_version,
            supported_comfyui_frontend_version:
              registryData.supported_comfyui_frontend_version,
            supported_os: registryData.supported_os as SupportedOS[],
            supported_accelerators:
              registryData.supported_accelerators as SupportedAccelerator[],
            dependencies: [], // Note: Registry Node doesn't have dependencies, only NodeVersion does

            // Status information
            registry_status: registryData.status,
            version_status: undefined, // We'd need to fetch specific version data for this
            is_banned:
              registryData.status === 'NodeStatusBanned' ||
              !typedNodeInfo.enabled,
            ban_reason:
              registryData.status === 'NodeStatusBanned'
                ? 'Package is banned in Registry'
                : !typedNodeInfo.enabled
                  ? 'Package is disabled locally'
                  : undefined,

            // Metadata
            registry_fetch_time: new Date().toISOString(),
            has_registry_data: true
          }

          requirements.push(requirement)

          console.log(`[ConflictDetection] Processed ${packageName}:`, {
            hasRegistryData: true,
            supportedOS: requirement.supported_os,
            supportedAccelerators: requirement.supported_accelerators,
            isBanned: requirement.is_banned
          })
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

      console.log(
        `[ConflictDetection] Successfully processed ${requirements.length} packages`
      )

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

    // 1. ComfyUI version conflict check
    if (packageReq.supported_comfyui_version && packageReq.has_registry_data) {
      const versionConflict = checkVersionStringConflict(
        'comfyui_version',
        sysEnv.comfyui_version,
        packageReq.supported_comfyui_version
      )
      if (versionConflict) conflicts.push(versionConflict)
    }

    // 2. Frontend version conflict check
    if (
      packageReq.supported_comfyui_frontend_version &&
      packageReq.has_registry_data
    ) {
      const versionConflict = checkVersionStringConflict(
        'frontend_version',
        sysEnv.frontend_version,
        packageReq.supported_comfyui_frontend_version
      )
      if (versionConflict) conflicts.push(versionConflict)
    }

    // 3. OS compatibility check
    if (packageReq.supported_os && packageReq.has_registry_data) {
      const osConflict = checkOSConflict(packageReq.supported_os, sysEnv.os)
      if (osConflict) conflicts.push(osConflict)
    }

    // 4. Accelerator compatibility check
    if (packageReq.supported_accelerators && packageReq.has_registry_data) {
      const acceleratorConflict = checkAcceleratorConflict(
        packageReq.supported_accelerators,
        sysEnv.available_accelerators
      )
      if (acceleratorConflict) conflicts.push(acceleratorConflict)
    }

    // 5. Banned package check
    if (packageReq.is_banned) {
      conflicts.push({
        type: 'banned',
        severity: 'error',
        description: `Package is banned: ${packageReq.ban_reason || 'Unknown reason'}`,
        current_value: 'installed',
        required_value: 'not_banned',
        resolution_steps: ['Remove package', 'Find alternative package']
      })
    }

    // 6. Registry data availability check
    if (!packageReq.has_registry_data) {
      conflicts.push({
        type: 'security_pending',
        severity: 'warning',
        description:
          'Registry data not available - compatibility cannot be verified',
        current_value: 'no_registry_data',
        required_value: 'registry_data_available',
        resolution_steps: [
          'Check if package exists in Registry',
          'Verify package name is correct',
          'Try again later if Registry is temporarily unavailable'
        ]
      })
    }

    // Generate result
    const hasConflict = conflicts.length > 0
    const canAutoResolve = conflicts.every(
      (c) => c.resolution_steps && c.resolution_steps.length > 0
    )

    return {
      package_id: packageReq.package_id,
      package_name: packageReq.package_name,
      has_conflict: hasConflict,
      conflicts,
      is_compatible: !hasConflict,
      can_auto_resolve: canAutoResolve,
      recommended_action: determineRecommendedAction(conflicts)
    }
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
      console.log('[ConflictDetection] Starting conflict detection...')

      // 1. Collect system environment information
      const sysEnv = await detectSystemEnvironment()

      // 2. Collect package requirement information
      const packageRequirements = await fetchPackageRequirements()

      // 3. Detect conflicts for each package
      const results: ConflictDetectionResult[] = []
      for (const packageReq of packageRequirements) {
        try {
          const result = detectPackageConflicts(packageReq, sysEnv)
          results.push(result)
        } catch (error) {
          console.warn(
            `[ConflictDetection] Failed to detect conflicts for package ${packageReq.package_name}:`,
            error
          )
          // Ignore individual package failures and continue
        }
      }

      // 4. Generate summary information
      const summary = generateSummary(results, Date.now() - startTime)

      // 5. Update state
      detectionResults.value = results
      detectionSummary.value = summary
      lastDetectionTime.value = new Date().toISOString()

      console.log('[ConflictDetection] Conflict detection completed:', summary)

      const response: ConflictDetectionResponse = {
        success: true,
        summary,
        results,
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
    console.log('[ConflictDetection] Starting initialization...')

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
    criticalConflicts,

    // Methods
    performConflictDetection,
    detectSystemEnvironment,
    initializeConflictDetection,
    cancelRequests
  }
}

// Helper Functions Implementation

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
 * Detects operating system from platform string.
 * @param platform Platform string from navigator
 * @returns Operating system type
 */
function detectOS(platform: string): SupportedOS {
  const p = platform.toLowerCase()
  if (p.includes('darwin') || p.includes('mac')) return 'macos'
  if (p.includes('linux')) return 'linux'
  if (p.includes('win')) return 'windows'
  return 'any'
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
      const device = systemStats.devices[0]
      const accelerators: SupportedAccelerator[] = []

      // Determine accelerator based on device type
      if (device.type === 'cuda') {
        accelerators.push('cuda')
      } else if (device.type === 'mps') {
        accelerators.push('mps')
      } else if (device.type === 'rocm') {
        accelerators.push('rocm')
      }

      accelerators.push('cpu') // CPU is always available

      return {
        available: accelerators,
        primary: (device.type as SupportedAccelerator) || 'cpu',
        memory_mb: device.vram_total
          ? Math.round(device.vram_total / 1024 / 1024)
          : undefined
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
    available: ['cpu'],
    primary: 'cpu',
    memory_mb: undefined
  }
}

/**
 * Checks for version conflicts using Registry API version strings.
 *
 * Registry version format examples
 * - ">=1.0.0" (minimum version
 * - "1.0.0" (exact version
 * - ">=1.0.0,<2.0.0" (version range
 *
 * @param type Type of version being checked
 * @param currentVersion Current version string
 * @param supportedVersion Supported version from Registry
 * @returns Conflict detail if conflict exists, null otherwise
 */
function checkVersionStringConflict(
  type: ConflictType,
  currentVersion: string,
  supportedVersion: string
): ConflictDetail | null {
  // If current version is unknown, assume compatible (no conflict)
  // This prevents false positives in test environments or when system detection fails
  if (currentVersion === 'unknown') {
    return null
  }

  // If Registry doesn't specify version requirements, assume compatible
  if (!supportedVersion || supportedVersion.trim() === '') {
    return null
  }

  // Basic version string parsing and comparison
  try {
    // Handle simple cases for now
    if (supportedVersion.startsWith('>=')) {
      const requiredVersion = supportedVersion.substring(2).trim()

      // Simple semver comparison for basic cases
      if (isVersionCompatible(currentVersion, requiredVersion)) {
        return null // Compatible
      } else {
        return {
          type,
          severity: 'warning',
          description: `${type} version might be incompatible`,
          current_value: currentVersion,
          required_value: supportedVersion,
          resolution_steps: [
            `Update ${type} to version ${requiredVersion} or higher`,
            'Check compatibility documentation'
          ]
        }
      }
    } else if (supportedVersion.includes(',')) {
      // Version range - for now just warn
      return {
        type,
        severity: 'info',
        description: `${type} version range specified in Registry`,
        current_value: currentVersion,
        required_value: supportedVersion,
        resolution_steps: [
          'Verify your version is within the supported range',
          'Update if necessary'
        ]
      }
    } else {
      // Exact version match
      if (currentVersion !== supportedVersion) {
        return {
          type,
          severity: 'warning',
          description: `${type} version mismatch`,
          current_value: currentVersion,
          required_value: supportedVersion,
          resolution_steps: [
            `Update ${type} to version ${supportedVersion}`,
            'Check if current version is compatible'
          ]
        }
      }
    }

    // No conflict detected
    return null
  } catch (error) {
    // If version parsing fails, return info-level conflict
    return {
      type,
      severity: 'info',
      description: `Unable to parse version requirement: ${supportedVersion}`,
      current_value: currentVersion,
      required_value: supportedVersion,
      resolution_steps: [
        'Check version format in Registry',
        'Manually verify compatibility'
      ]
    }
  }
}

/**
 * Checks for OS compatibility conflicts.
 * @param supportedOS List of supported operating systems
 * @param currentOS Current operating system
 * @returns Conflict detail if conflict exists, null otherwise
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
    severity: 'error',
    description: `Unsupported operating system`,
    current_value: currentOS,
    required_value: supportedOS.join(', '),
    resolution_steps: ['Switch to supported OS', 'Find alternative package']
  }
}

/**
 * Checks for accelerator compatibility conflicts.
 * @param supportedAccelerators List of supported accelerators
 * @param availableAccelerators List of available accelerators
 * @returns Conflict detail if conflict exists, null otherwise
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
    severity: 'error',
    description: `Required GPU/accelerator not available`,
    current_value: availableAccelerators.join(', '),
    required_value: supportedAccelerators.join(', '),
    resolution_steps: ['Install GPU drivers', 'Install CUDA/ROCm']
  }
}

/**
 * Determines recommended action based on detected conflicts.
 * @param conflicts Array of detected conflicts
 * @returns Recommended action object
 */
function determineRecommendedAction(
  conflicts: ConflictDetail[]
): RecommendedAction {
  if (conflicts.length === 0) {
    return {
      action_type: 'ignore',
      reason: 'No conflicts detected',
      steps: [],
      estimated_difficulty: 'easy'
    }
  }

  const hasError = conflicts.some((c) => c.severity === 'error')

  return {
    action_type: hasError ? 'disable' : 'manual_review',
    reason: hasError
      ? 'Critical compatibility issues found'
      : 'Warning items need review',
    steps: conflicts.flatMap((c) => c.resolution_steps || []),
    estimated_difficulty: hasError ? 'hard' : 'medium'
  }
}

/**
 * Generates summary of conflict detection results.
 * @param results Array of conflict detection results
 * @param durationMs Duration of the detection process in milliseconds
 * @returns Conflict detection summary
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
    security_pending: 0
  }

  let bannedCount = 0
  let securityPendingCount = 0

  results.forEach((result) => {
    result.conflicts.forEach((conflict) => {
      conflictsByType[conflict.type]++
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
    conflicts_by_type: conflictsByType,
    last_check_timestamp: new Date().toISOString(),
    check_duration_ms: durationMs
  }
}

/**
 * Creates an empty summary for error cases.
 * @returns Empty conflict detection summary
 */
function getEmptySummary(): ConflictDetectionSummary {
  return {
    total_packages: 0,
    compatible_packages: 0,
    conflicted_packages: 0,
    banned_packages: 0,
    security_pending_packages: 0,
    conflicts_by_type: {
      comfyui_version: 0,
      frontend_version: 0,
      python_version: 0,
      os: 0,
      accelerator: 0,
      banned: 0,
      security_pending: 0
    },
    last_check_timestamp: new Date().toISOString(),
    check_duration_ms: 0
  }
}

/**
 * Simple version compatibility check for >= requirements
 * @param current Current version (e.g., "0.3.41")
 * @param required Required minimum version (e.g., "0.3.0")
 * @returns true if current >= required
 */
function isVersionCompatible(current: string, required: string): boolean {
  try {
    // Simple version parsing for x.y.z format
    const currentParts = current.split('.').map((n) => parseInt(n, 10))
    const requiredParts = required.split('.').map((n) => parseInt(n, 10))

    // Pad arrays to same length
    while (currentParts.length < requiredParts.length) currentParts.push(0)
    while (requiredParts.length < currentParts.length) requiredParts.push(0)

    // Compare each part
    for (
      let i = 0;
      i < Math.max(currentParts.length, requiredParts.length);
      i++
    ) {
      const currentPart = currentParts[i] || 0
      const requiredPart = requiredParts[i] || 0

      if (currentPart > requiredPart) return true
      if (currentPart < requiredPart) return false
      // If equal, continue to next part
    }

    return true // Equal versions are compatible
  } catch {
    // If parsing fails, assume compatible to avoid false positives
    return true
  }
}
