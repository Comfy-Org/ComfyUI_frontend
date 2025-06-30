import { computed, readonly, ref } from 'vue'

import config from '@/config'
import { api } from '@/scripts/api'
import { useComfyManagerService } from '@/services/comfyManagerService'
import type { InstalledPacksResponse } from '@/types/comfyManagerTypes'
import type {
  ConflictDetail,
  ConflictDetectionResponse,
  ConflictDetectionResult,
  ConflictDetectionSummary,
  ConflictType,
  NodePackRequirements,
  SystemEnvironment,
  VersionRequirement
} from '@/types/conflictDetectionTypes'

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

      // Fetch version information from backend (with error resilience)
      const [comfyuiVersion, frontendVersion, pythonVersion] =
        await Promise.allSettled([
          fetchComfyUIVersion(),
          fetchFrontendVersion(),
          fetchPythonVersion()
        ])

      // Detect GPU/accelerator information
      const acceleratorInfo = await detectAccelerators()

      const environment: SystemEnvironment = {
        // Version information (use 'unknown' on failure)
        comfyui_version:
          comfyuiVersion.status === 'fulfilled'
            ? comfyuiVersion.value
            : 'unknown',
        frontend_version:
          frontendVersion.status === 'fulfilled'
            ? frontendVersion.value
            : 'unknown',
        python_version:
          pythonVersion.status === 'fulfilled'
            ? pythonVersion.value
            : 'unknown',

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

      // Provide basic environment information even on error
      const fallbackEnvironment: SystemEnvironment = {
        comfyui_version: 'unknown',
        frontend_version: 'unknown',
        python_version: 'unknown',
        os: detectOS(navigator.platform),
        platform_details: navigator.platform,
        architecture: 'unknown',
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
   * Fetches requirement information for installed packages.
   *
   * NOTE: This is a temporary implementation using existing APIs as fallback.
   * The ideal solution would be a dedicated `/api/customnode/requirements` endpoint
   * that provides actual compatibility metadata (min versions, supported OS/GPU, etc.)
   * from package manifests like pyproject.toml or package.json.
   *
   * Current implementation limitations:
   * - Uses basic assumptions (all packages support 'any' OS/accelerator)
   * - Treats disabled nodes as banned packages
   * - Security status is always 'unknown'
   * - No real version requirement checking
   *
   * When the proper API becomes available, this function should be updated to:
   * 1. Call the new endpoint instead of generating mock data
   * 2. Use real compatibility requirements from package metadata
   * 3. Provide accurate security scan results
   *
   * @returns Promise that resolves to array of node pack requirements
   */
  async function fetchPackageRequirements(): Promise<NodePackRequirements[]> {
    try {
      console.log('[ConflictDetection] Fetching package requirements...')

      // Get installed package list using ComfyManagerService
      const comfyManagerService = useComfyManagerService()
      const installedNodes: InstalledPacksResponse | null =
        await comfyManagerService.listInstalledPacks()

      if (!installedNodes) {
        console.warn(
          '[ConflictDetection] Unable to fetch installed package information'
        )
        return []
      }

      console.log(
        '[ConflictDetection] Original installed custom nodes data:',
        installedNodes
      )

      // Convert API response object to array
      const nodeEntries = Object.entries(installedNodes)
      console.log(
        `[ConflictDetection] Retrieved ${nodeEntries.length} installed custom nodes`
      )

      // TEMPORARY: Generate basic requirements based on installed node information
      // This should be replaced with actual API call when `/api/customnode/requirements` is available
      const requirements: NodePackRequirements[] = nodeEntries.map(
        ([packageName, nodeInfo]) => ({
          package_id: packageName,
          package_name: packageName,
          version: nodeInfo.ver || 'unknown',
          supported_os: ['any'], // TODO: Get from package metadata
          supported_accelerators: ['any'], // TODO: Get from package metadata
          is_banned: !nodeInfo.enabled, // ASSUMPTION: disabled = banned
          ban_reason: !nodeInfo.enabled ? 'Node is disabled' : undefined,
          security_scan_status: 'unknown' as const, // TODO: Get from security API
          last_updated: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
      )

      console.log('[ConflictDetection] Generated requirements:', requirements)

      return requirements
    } catch (error) {
      console.warn(
        '[ConflictDetection] Failed to fetch package requirements:',
        error
      )
      // Return empty array if API is unavailable or fails
      return []
    }
  }

  /**
   * Detects conflicts for an individual package.
   * @param packageReq Package requirements to check
   * @param sysEnv Current system environment
   * @returns Conflict detection result for the package
   */
  function detectPackageConflicts(
    packageReq: NodePackRequirements,
    sysEnv: SystemEnvironment
  ): ConflictDetectionResult {
    const conflicts: ConflictDetail[] = []

    // 1. ComfyUI version conflict check
    if (packageReq.comfyui_version_requirement) {
      const versionConflict = checkVersionConflict(
        'comfyui_version',
        sysEnv.comfyui_version,
        packageReq.comfyui_version_requirement
      )
      if (versionConflict) conflicts.push(versionConflict)
    }

    // 2. Frontend version conflict check
    if (packageReq.frontend_version_requirement) {
      const versionConflict = checkVersionConflict(
        'frontend_version',
        sysEnv.frontend_version,
        packageReq.frontend_version_requirement
      )
      if (versionConflict) conflicts.push(versionConflict)
    }

    // 3. Python version conflict check
    if (packageReq.python_version_requirement) {
      const versionConflict = checkVersionConflict(
        'python_version',
        sysEnv.python_version,
        packageReq.python_version_requirement
      )
      if (versionConflict) conflicts.push(versionConflict)
    }

    // 4. OS compatibility check
    const osConflict = checkOSConflict(packageReq.supported_os, sysEnv.os)
    if (osConflict) conflicts.push(osConflict)

    // 5. Accelerator compatibility check
    const acceleratorConflict = checkAcceleratorConflict(
      packageReq.supported_accelerators,
      sysEnv.available_accelerators
    )
    if (acceleratorConflict) conflicts.push(acceleratorConflict)

    // 6. Banned package check
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

    // 7. Security verification status check
    if (packageReq.security_scan_status === 'pending') {
      conflicts.push({
        type: 'security_pending',
        severity: 'warning',
        description: 'Security verification not completed',
        current_value: 'pending',
        required_value: 'passed',
        resolution_steps: [
          'Wait for security verification completion',
          'Use trusted packages'
        ]
      })
    } else if (packageReq.security_scan_status === 'failed') {
      conflicts.push({
        type: 'security_pending',
        severity: 'error',
        description: `Security verification failed: ${packageReq.security_scan_details || ''}`,
        current_value: 'failed',
        required_value: 'passed',
        resolution_steps: [
          'Remove package',
          'Wait for security issue resolution'
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
    }
  }

  /**
   * Error-resilient initialization (called on app mount).
   * Uses setTimeout to avoid blocking other component initialization.
   */
  function initializeConflictDetection(): void {
    console.log('[ConflictDetection] Starting initialization (async)')

    // Use setTimeout to avoid interfering with other component initialization
    setTimeout(async () => {
      try {
        await performConflictDetection()
      } catch (error) {
        console.warn(
          '[ConflictDetection] Error during initialization (ignored):',
          error
        )
        // Errors do not affect other parts of the app
      }
    }, 100) // Execute after 100ms to allow other components to initialize first
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
    initializeConflictDetection
  }
}

// Helper Functions Implementation

/**
 * Fetches ComfyUI version from system stats.
 * @returns Promise that resolves to ComfyUI version string
 */
async function fetchComfyUIVersion(): Promise<string> {
  try {
    // Get ComfyUI version from system_stats
    const response = await api.fetchApi('/system_stats')
    const data = await response.json()
    return data.system?.comfyui_version || 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Fetches frontend version from config.
 * @returns Promise that resolves to frontend version string
 */
async function fetchFrontendVersion(): Promise<string> {
  try {
    // Get frontend version from config
    return import.meta.env.VITE_APP_VERSION || config.app_version || 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Fetches Python version from system stats.
 * @returns Promise that resolves to Python version string
 */
async function fetchPythonVersion(): Promise<string> {
  try {
    // Get Python version from system_stats
    const response = await api.fetchApi('/system_stats')
    const data = await response.json()
    return data.system?.python_version || 'unknown'
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
function detectOS(platform: string): any {
  const p = platform.toLowerCase()
  if (p.includes('win')) return 'windows'
  if (p.includes('mac')) return 'macos'
  if (p.includes('linux')) return 'linux'
  return 'any'
}

/**
 * Detects available accelerators from system stats.
 * @returns Promise that resolves to accelerator information
 */
async function detectAccelerators(): Promise<any> {
  try {
    // Get GPU information from system_stats
    const response = await api.fetchApi('/system_stats')
    const data = await response.json()

    if (data.devices && data.devices.length > 0) {
      const device = data.devices[0]
      const accelerators = []

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
        primary: device.type || 'cpu',
        memory_mb: device.vram_total
          ? Math.round(device.vram_total / 1024 / 1024)
          : undefined
      }
    }
  } catch (error) {
    console.warn('[ConflictDetection] Failed to detect GPU information:', error)
  }

  // Default values
  return {
    available: ['cpu'],
    primary: 'cpu',
    memory_mb: undefined
  }
}

/**
 * Checks for version conflicts between current and required versions.
 * @param type Type of version being checked
 * @param currentVersion Current version string
 * @param requirement Version requirement specification
 * @returns Conflict detail if conflict exists, null otherwise
 */
function checkVersionConflict(
  type: ConflictType,
  currentVersion: string,
  requirement: VersionRequirement
): ConflictDetail | null {
  // Version comparison logic implementation
  if (currentVersion === 'unknown') {
    return {
      type,
      severity: 'warning',
      description: `Cannot verify ${type} version`,
      current_value: currentVersion,
      required_value: `${requirement.operator} ${requirement.version}`,
      resolution_steps: ['Check system version', 'Compare with requirements']
    }
  }

  // Actual version comparison logic should be implemented using semver library
  return null
}

/**
 * Checks for OS compatibility conflicts.
 * @param supportedOS List of supported operating systems
 * @param currentOS Current operating system
 * @returns Conflict detail if conflict exists, null otherwise
 */
function checkOSConflict(
  supportedOS: any[],
  currentOS: any
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
  supportedAccelerators: any[],
  availableAccelerators: any[]
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
function determineRecommendedAction(conflicts: ConflictDetail[]): any {
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
