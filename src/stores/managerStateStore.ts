import { defineStore } from 'pinia'

import { api } from '@/scripts/api'
import { useSystemStatsStore } from '@/stores/systemStatsStore'

export enum ManagerUIState {
  DISABLED = 'disabled',
  LEGACY_UI = 'legacy',
  NEW_UI = 'new'
}

export const useManagerStateStore = defineStore('managerState', () => {
  const systemStatsStore = useSystemStatsStore()

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

    const serverSupportsV4 = api.getServerFeature(
      'extension.manager.supports_v4'
    )

    const result = {
      systemStats: systemStats?.system?.argv,
      clientSupportsV4,
      serverSupportsV4
    }
    console.log('[Manager State Debug]', result)

    // Check command line args first (highest priority)
    if (systemStats?.system?.argv?.includes('--disable-manager')) {
      console.log(
        '[Manager State] Returning DISABLED due to --disable-manager flag'
      )
      return ManagerUIState.DISABLED
    }

    if (systemStats?.system?.argv?.includes('--enable-manager-legacy-ui')) {
      console.log(
        '[Manager State] Returning LEGACY_UI due to --enable-manager-legacy-ui flag'
      )
      return ManagerUIState.LEGACY_UI
    }

    // Both client and server support v4 = NEW_UI
    if (clientSupportsV4 && serverSupportsV4 === true) {
      console.log('[Manager State] Returning NEW_UI (both support v4)')
      return ManagerUIState.NEW_UI
    }

    // Server supports v4 but client doesn't = LEGACY_UI
    if (serverSupportsV4 === true) {
      console.log(
        '[Manager State] Returning LEGACY_UI (server supports v4, client does not)'
      )
      return ManagerUIState.LEGACY_UI
    }

    // If server feature flags haven't loaded yet, default to NEW_UI
    // This is the safest default since v2 API is the current standard
    if (serverSupportsV4 === undefined) {
      console.log(
        '[Manager State] Returning NEW_UI (server feature flags not loaded, using default)'
      )
      return ManagerUIState.NEW_UI
    }

    // No manager at all = DISABLED
    console.log('[Manager State] Returning DISABLED (no manager support)')
    return ManagerUIState.DISABLED
  }

  return {
    getManagerUIState
  }
})
