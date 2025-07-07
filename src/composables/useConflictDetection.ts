import { computed, getCurrentInstance, onUnmounted, readonly, ref } from 'vue'

import config from '@/config'
import { useComfyManagerService } from '@/services/comfyManagerService'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
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
import {
  cleanVersion,
  describeVersionRange,
  satisfiesVersion
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
      // Generate user-friendly description using shared utility
      const rangeDescription = describeVersionRange(supportedVersion)
      const description = `${type} version incompatible: requires ${rangeDescription}`

      // Generate resolution steps based on version range type
      let resolutionSteps: string[] = []

      if (supportedVersion.startsWith('>=')) {
        const minVersion = supportedVersion.substring(2).trim()
        resolutionSteps = [
          `Update ${type} to version ${minVersion} or higher`,
          'Check release notes for compatibility changes'
        ]
      } else if (supportedVersion.includes(' - ')) {
        resolutionSteps = [
          'Verify your version is within the supported range',
          `Supported range: ${supportedVersion}`
        ]
      } else if (supportedVersion.includes('||')) {
        resolutionSteps = [
          'Check which version ranges are supported',
          `Supported: ${supportedVersion}`
        ]
      } else if (
        supportedVersion.startsWith('^') ||
        supportedVersion.startsWith('~')
      ) {
        resolutionSteps = [
          `Compatible versions: ${supportedVersion}`,
          'Consider updating or downgrading as needed'
        ]
      } else {
        resolutionSteps = [
          `Required version: ${supportedVersion}`,
          'Check if your version is compatible'
        ]
      }

      return {
        type,
        severity: 'warning',
        description,
        current_value: currentVersion,
        required_value: supportedVersion,
        resolution_steps: resolutionSteps
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

  const conflictsByTypeDetails: Record<ConflictType, string[]> = {
    comfyui_version: [],
    frontend_version: [],
    python_version: [],
    os: [],
    accelerator: [],
    banned: [],
    security_pending: []
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
      security_pending: []
    },
    last_check_timestamp: new Date().toISOString(),
    check_duration_ms: 0
  }
}
