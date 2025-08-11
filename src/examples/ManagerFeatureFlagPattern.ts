/**
 * Example showing the proper pattern for using manager feature flags
 * alongside command line configuration checks
 */

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useComfyManagerService } from '@/services/comfyManagerService'
import { useDialogService } from '@/services/dialogService'
import { useCommandStore } from '@/stores/commandStore'
import { useToastStore } from '@/stores/toastStore'

/**
 * Proper pattern for handling manager UI decisions
 */
export async function openManagerUI() {
  const { flags } = useFeatureFlags()
  const managerService = useComfyManagerService()
  const dialogService = useDialogService()
  const commandStore = useCommandStore()
  const toastStore = useToastStore()

  // Step 1: Check command line configuration (user's choice)
  const managerConfig = await managerService.isLegacyManagerUI()
  
  if (!managerConfig) {
    // Manager might be disabled
    toastStore.add({
      severity: 'error',
      summary: 'Manager Unavailable',
      detail: 'ComfyUI Manager is not available',
      life: 3000
    })
    return
  }

  // Step 2: User explicitly requested legacy UI via --enable-manager-legacy-ui
  if (managerConfig.is_legacy_manager_ui === true) {
    try {
      await commandStore.execute('Comfy.Manager.Menu.ToggleVisibility')
    } catch (error) {
      // Legacy UI failed to load
      toastStore.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Legacy manager UI is not available',
        life: 3000
      })
      
      // Could fall back to new UI if available
      if (flags.managerApiVersion === 'v2' && flags.supportsManagerV4) {
        dialogService.showManagerDialog()
      }
    }
    return
  }

  // Step 3: No specific UI requested, use capabilities to decide
  if (flags.managerApiVersion === 'v2' && flags.supportsManagerV4) {
    // New manager is available
    dialogService.showManagerDialog()
  } else {
    // Fall back to legacy
    try {
      await commandStore.execute('Comfy.Manager.Menu.ToggleVisibility')
    } catch (error) {
      toastStore.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Manager UI is not available',
        life: 3000
      })
    }
  }
}

/**
 * Example of using feature flags for API version-specific code
 */
export function useManagerAPI() {
  const { flags } = useFeatureFlags()
  const managerService = useComfyManagerService()
  
  async function installPack(packId: string) {
    if (flags.managerApiVersion === 'v2') {
      // Use v2 API with enhanced features
      console.log('Using v2 API for installation')
      return await managerService.installPack({
        id: packId,
        // v2 specific options...
      })
    } else {
      // Use v1 API
      console.log('Using v1 API for installation')
      // Might need different parameters or methods
    }
  }
  
  function getAvailableFeatures() {
    const features = ['install', 'uninstall', 'update']
    
    if (flags.supportsManagerV4) {
      // v4 adds these capabilities
      features.push('batch-operations', 'dependency-resolution', 'rollback')
    }
    
    if (flags.managerApiVersion === 'v2') {
      // v2 API supports these
      features.push('progress-tracking', 'detailed-errors')
    }
    
    return features
  }
  
  return {
    installPack,
    getAvailableFeatures,
    apiVersion: flags.managerApiVersion,
    supportsV4: flags.supportsManagerV4
  }
}