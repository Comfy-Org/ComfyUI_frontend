import { defineStore } from 'pinia'
import { readonly, ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { api } from '@/scripts/api'
import { useComfyManagerService } from '@/services/comfyManagerService'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

export enum ManagerUIState {
  DISABLED = 'disabled',
  LEGACY_UI = 'legacy',
  NEW_UI = 'new'
}

export const useManagerStateStore = defineStore('managerState', () => {
  const managerUIState = ref<ManagerUIState | null>(null)
  const isInitialized = ref(false)

  const initializeManagerState = async () => {
    if (isInitialized.value) return

    const systemStats = useSystemStatsStore().systemStats
    const { flags } = useFeatureFlags()
    const clientSupportsV4 =
      api.getClientFeatureFlags().supports_manager_v4_ui ?? false

    // Check command line args first
    if (systemStats?.system?.argv?.includes('--disable-manager')) {
      managerUIState.value = ManagerUIState.DISABLED
    } else if (
      systemStats?.system?.argv?.includes('--enable-manager-legacy-ui')
    ) {
      managerUIState.value = ManagerUIState.LEGACY_UI
    } else {
      // Check if we can use new UI
      if (clientSupportsV4 && flags.supportsManagerV4) {
        managerUIState.value = ManagerUIState.NEW_UI
      } else {
        // For old frontend, we need to check if legacy manager exists
        try {
          await useComfyManagerService().isLegacyManagerUI()
          // Route exists but we can't use v4
          managerUIState.value = ManagerUIState.LEGACY_UI
        } catch {
          // Route doesn't exist = old manager OR no manager
          // Old frontend will handle this itself
          managerUIState.value = ManagerUIState.LEGACY_UI
        }
      }
    }

    isInitialized.value = true
  }

  return {
    managerUIState: readonly(managerUIState),
    initializeManagerState
  }
})
