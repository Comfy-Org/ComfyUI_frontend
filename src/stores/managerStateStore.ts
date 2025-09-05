import { defineStore } from 'pinia'
import { computed, readonly } from 'vue'

import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

export enum ManagerUIState {
  DISABLED = 'disabled',
  LEGACY_UI = 'legacy',
  NEW_UI = 'new'
}

export const useManagerStateStore = defineStore('managerState', () => {
  const systemStatsStore = useSystemStatsStore()
  const extensionStore = useExtensionStore()

  // Reactive computed manager state that updates when dependencies change
  const managerUIState = computed(() => {
    const systemStats = systemStatsStore.systemStats
    const clientSupportsV4 =
      api.getClientFeatureFlags().supports_manager_v4_ui ?? false
    const hasLegacyManager = extensionStore.extensions.some(
      (ext) => ext.name === 'Comfy.CustomNodesManager'
    )

    const serverSupportsV4 = api.getServerFeature(
      'extension.manager.supports_v4'
    )

    // Check command line args first
    if (systemStats?.system?.argv?.includes('--disable-manager')) {
      return ManagerUIState.DISABLED // comfyui_manager package not installed
    }

    if (systemStats?.system?.argv?.includes('--enable-manager-legacy-ui')) {
      return ManagerUIState.LEGACY_UI // forced legacy
    }

    // Both client and server support v4 = NEW_UI
    if (clientSupportsV4 && serverSupportsV4 === true) {
      return ManagerUIState.NEW_UI
    }

    // Server supports v4 but client doesn't = LEGACY_UI
    if (serverSupportsV4 === true) {
      return ManagerUIState.LEGACY_UI
    }

    // No server v4 support but legacy manager extension exists = LEGACY_UI
    if (hasLegacyManager) {
      return ManagerUIState.LEGACY_UI
    }

    // If server feature flags haven't loaded yet, return DISABLED for now
    // This will update reactively once feature flags load
    if (serverSupportsV4 === undefined) {
      return ManagerUIState.DISABLED
    }

    // No manager at all = DISABLED
    return ManagerUIState.DISABLED
  })

  return {
    managerUIState: readonly(managerUIState)
  }
})
