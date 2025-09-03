import { defineStore } from 'pinia'

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

  /**
   * Get the current manager UI state.
   * This is NOT reactive - it computes the value fresh each time it's called.
   * This ensures we always get the latest state without timing issues.
   */
  const getManagerUIState = (): ManagerUIState => {
    // Get current values at the time of function call
    const systemStats = systemStatsStore.systemStats
    const clientSupportsV4 =
      api.getClientFeatureFlags().supports_manager_v4_ui ?? false
    const hasLegacyManager = extensionStore.extensions.some(
      (ext) => ext.name === 'Comfy.CustomNodesManager'
    )

    const serverSupportsV4 = api.getServerFeature(
      'extension.manager.supports_v4'
    )

    console.log('[Manager State Debug]', {
      systemStats: systemStats?.system?.argv,
      clientSupportsV4,
      serverSupportsV4,
      hasLegacyManager,
      extensions: extensionStore.extensions.map((e) => e.name)
    })

    // Check command line args first (highest priority)
    if (systemStats?.system?.argv?.includes('--disable-manager')) {
      return ManagerUIState.DISABLED
    }

    if (systemStats?.system?.argv?.includes('--enable-manager-legacy-ui')) {
      return ManagerUIState.LEGACY_UI
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
    if (serverSupportsV4 === undefined) {
      return ManagerUIState.DISABLED
    }

    // No manager at all = DISABLED
    return ManagerUIState.DISABLED
  }

  return {
    getManagerUIState
  }
})
