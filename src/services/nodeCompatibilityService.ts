import { useConflictDetection } from '@/composables/useConflictDetection'
import { useComfyManagerService } from '@/services/comfyManagerService'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import { useNodeCompatibilityStore } from '@/stores/nodeCompatibilityStore'
import type { components } from '@/types/comfyRegistryTypes'
import type {
  ConflictType,
  SupportedAccelerator,
  SupportedOS,
  SystemEnvironment
} from '@/types/conflictDetectionTypes'
import type { components as ManagerComponents } from '@/types/generatedManagerTypes'

export interface NodeCompatibilityCheckResult {
  nodeId: string
  nodeName: string
  isCompatible: boolean
  shouldDisable: boolean
  disableReason?: ConflictType
  conflictDetails?: string
  registryData?: components['schemas']['Node']
}

export interface CompatibilityCheckSummary {
  totalChecked: number
  compatibleNodes: number
  incompatibleNodes: number
  autoDisabledNodes: number
  checkDurationMs: number
  hasErrors: boolean
  errorMessage?: string
}

/**
 * Service for performing node compatibility checks and managing auto-disable functionality.
 * Leverages existing conflict detection logic and Registry API integration.
 */
export function useNodeCompatibilityService() {
  const compatibilityStore = useNodeCompatibilityStore()
  const conflictDetection = useConflictDetection()
  const managerService = useComfyManagerService()
  const registryStore = useComfyRegistryStore()

  /**
   * Performs complete node compatibility check during app initialization.
   * Error-resilient and asynchronous to avoid blocking other initialization.
   */
  async function performCompatibilityCheck(): Promise<CompatibilityCheckSummary> {
    const startTime = Date.now()

    try {
      console.log('[NodeCompatibility] Starting compatibility check...')
      compatibilityStore.setCheckingState(true)
      compatibilityStore.clearResults()

      // Step 1: Detect system environment using existing logic
      const systemEnv = await conflictDetection.detectSystemEnvironment()
      compatibilityStore.setSystemEnvironment(systemEnv)

      // Step 2: Get installed packages
      const installedPacks:
        | ManagerComponents['schemas']['InstalledPacksResponse']
        | null = await managerService.listInstalledPacks()
      if (!installedPacks) {
        throw new Error('Failed to fetch installed packages')
      }

      const packageIds = Object.keys(installedPacks)
      console.log(
        '[NodeCompatibility] Found installed packages:',
        packageIds.length
      )

      // Step 3: Fetch Registry data for compatibility checking
      const registryPacks = await registryStore.getPacksByIds.call(packageIds)
      const registryMap = new Map<string, components['schemas']['Node']>()
      registryPacks.forEach((pack) => {
        if (pack?.id) {
          registryMap.set(pack.id, pack)
        }
      })

      // Step 4: Check each installed package for compatibility
      const results: NodeCompatibilityCheckResult[] = []

      for (const [packageId, packageInfo] of Object.entries(installedPacks)) {
        try {
          const result = await checkNodeCompatibility(
            packageId,
            packageInfo,
            registryMap.get(packageId),
            systemEnv
          )

          results.push(result)

          // Record incompatible nodes (but don't auto-disable)
          if (
            !result.isCompatible &&
            result.disableReason &&
            result.conflictDetails
          ) {
            compatibilityStore.addIncompatibleNode(
              packageId,
              result.nodeName,
              result.disableReason,
              result.conflictDetails
            )
          }
        } catch (error) {
          console.warn(
            `[NodeCompatibility] Failed to check ${packageId}:`,
            error
          )

          // Add to failed imports if this looks like an import failure
          if (error instanceof Error && error.message.includes('import')) {
            compatibilityStore.failedImportNodes.add(packageId)
          }
        }
      }

      // Step 5: Record successful completion
      compatibilityStore.recordCheckCompletion()

      const summary: CompatibilityCheckSummary = {
        totalChecked: results.length,
        compatibleNodes: results.filter((r) => r.isCompatible).length,
        incompatibleNodes: results.filter((r) => !r.isCompatible).length,
        autoDisabledNodes: 0, // Auto-disable feature removed
        checkDurationMs: Date.now() - startTime,
        hasErrors: false
      }

      console.log('[NodeCompatibility] Compatibility check completed:', summary)
      return summary
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.error('[NodeCompatibility] Compatibility check failed:', error)

      compatibilityStore.recordCheckError(errorMessage)

      return {
        totalChecked: 0,
        compatibleNodes: 0,
        incompatibleNodes: 0,
        autoDisabledNodes: 0, // Auto-disable feature removed
        checkDurationMs: Date.now() - startTime,
        hasErrors: true,
        errorMessage
      }
    }
  }

  /**
   * Checks compatibility for a single node package.
   */
  async function checkNodeCompatibility(
    packageId: string,
    packageInfo: ManagerComponents['schemas']['ManagerPackInstalled'],
    registryData: components['schemas']['Node'] | undefined,
    systemEnv: SystemEnvironment
  ): Promise<NodeCompatibilityCheckResult> {
    const result: NodeCompatibilityCheckResult = {
      nodeId: packageId,
      nodeName: registryData?.name || packageId,
      isCompatible: true,
      shouldDisable: false,
      registryData
    }

    // Check 1: Banned packages
    if (registryData?.status === 'NodeStatusBanned' || !packageInfo.enabled) {
      result.isCompatible = false
      result.shouldDisable = false // No auto-disable
      result.disableReason = 'banned'
      result.conflictDetails =
        registryData?.status === 'NodeStatusBanned'
          ? 'Package is banned in Registry'
          : 'Package is disabled locally'
      return result
    }

    // Check 2: Security pending packages (no registry data)
    if (!registryData) {
      result.isCompatible = false
      result.shouldDisable = false // No auto-disable
      result.disableReason = 'security_pending'
      result.conflictDetails =
        'Registry data not available - compatibility cannot be verified'
      return result
    }

    // Check 3: Version compatibility using existing conflict detection logic
    const conflicts = await detectPackageConflicts(registryData, systemEnv)

    if (conflicts.length > 0) {
      result.isCompatible = false
      result.shouldDisable = false // No auto-disable

      // Use the first conflict as the reason
      result.disableReason = conflicts[0].type
      result.conflictDetails = conflicts[0].description
    }

    return result
  }

  /**
   * Detects conflicts for a package using Registry data.
   * Reuses logic from useConflictDetection composable.
   */
  async function detectPackageConflicts(
    registryData: components['schemas']['Node'],
    systemEnv: SystemEnvironment
  ): Promise<
    Array<{ type: ConflictType; severity: string; description: string }>
  > {
    const conflicts: Array<{
      type: ConflictType
      severity: string
      description: string
    }> = []

    // ComfyUI version check
    if (registryData.supported_comfyui_version) {
      const versionConflict = checkVersionConflict(
        'comfyui_version',
        systemEnv.comfyui_version,
        registryData.supported_comfyui_version
      )
      if (versionConflict) conflicts.push(versionConflict)
    }

    // Frontend version check
    if (registryData.supported_comfyui_frontend_version) {
      const versionConflict = checkVersionConflict(
        'frontend_version',
        systemEnv.frontend_version,
        registryData.supported_comfyui_frontend_version
      )
      if (versionConflict) conflicts.push(versionConflict)
    }

    // OS compatibility check
    if (registryData.supported_os && registryData.supported_os.length > 0) {
      const osConflict = checkOSConflict(
        registryData.supported_os as SupportedOS[],
        systemEnv.os
      )
      if (osConflict) conflicts.push(osConflict)
    }

    // Accelerator compatibility check
    if (
      registryData.supported_accelerators &&
      registryData.supported_accelerators.length > 0
    ) {
      const acceleratorConflict = checkAcceleratorConflict(
        registryData.supported_accelerators as SupportedAccelerator[],
        systemEnv.available_accelerators
      )
      if (acceleratorConflict) conflicts.push(acceleratorConflict)
    }

    return conflicts
  }

  /**
   * Error-resilient initialization function.
   * Can be called during app startup without affecting other components.
   */
  function initializeCompatibilityCheck(): void {
    console.log('[NodeCompatibility] Scheduling compatibility check...')

    // Use setTimeout to avoid blocking other initialization
    setTimeout(async () => {
      try {
        await performCompatibilityCheck()
      } catch (error) {
        console.warn(
          '[NodeCompatibility] Initialization failed (ignored):',
          error
        )
        // Errors are logged but don't affect app startup
      }
    }, 200) // Small delay to allow other components to initialize
  }

  return {
    // Main methods
    performCompatibilityCheck,
    checkNodeCompatibility,
    initializeCompatibilityCheck,

    // Store access
    compatibilityStore,

    // State
    isChecking: compatibilityStore.isChecking,
    hasIncompatibleNodes: compatibilityStore.hasIncompatibleNodes,
    shouldShowNotification: compatibilityStore.shouldShowNotification
  }
}

// Helper functions for conflict detection (simplified versions from useConflictDetection)

function checkVersionConflict(
  type: ConflictType,
  currentVersion: string,
  supportedVersion: string
): { type: ConflictType; severity: string; description: string } | null {
  if (currentVersion === 'unknown') {
    return {
      type,
      severity: 'warning',
      description: `Cannot verify ${type} - current version unknown`
    }
  }

  if (!supportedVersion || supportedVersion.trim() === '') {
    return null
  }

  // Simple version check - for production, use proper semver comparison
  if (supportedVersion.startsWith('>=')) {
    const requiredVersion = supportedVersion.substring(2).trim()
    if (
      currentVersion !== requiredVersion &&
      !currentVersion.includes(requiredVersion)
    ) {
      return {
        type,
        severity: 'error',
        description: `${type} incompatible: requires ${supportedVersion}, current: ${currentVersion}`
      }
    }
  } else if (currentVersion !== supportedVersion) {
    return {
      type,
      severity: 'error',
      description: `${type} mismatch: requires ${supportedVersion}, current: ${currentVersion}`
    }
  }

  return null
}

function checkOSConflict(
  supportedOS: SupportedOS[],
  currentOS: SupportedOS
): { type: ConflictType; severity: string; description: string } | null {
  if (supportedOS.includes('any') || supportedOS.includes(currentOS)) {
    return null
  }

  return {
    type: 'os',
    severity: 'error',
    description: `Unsupported OS: requires ${supportedOS.join(', ')}, current: ${currentOS}`
  }
}

function checkAcceleratorConflict(
  supportedAccelerators: SupportedAccelerator[],
  availableAccelerators: SupportedAccelerator[]
): { type: ConflictType; severity: string; description: string } | null {
  if (
    supportedAccelerators.includes('any') ||
    supportedAccelerators.some((acc) => availableAccelerators.includes(acc))
  ) {
    return null
  }

  return {
    type: 'accelerator',
    severity: 'error',
    description: `Required accelerator not available: requires ${supportedAccelerators.join(', ')}, available: ${availableAccelerators.join(', ')}`
  }
}
