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
    if (serverSupportsV4 === true && !clientSupportsV4) {
      return ManagerUIState.LEGACY_UI
    }

    // Server explicitly doesn't support v4 = LEGACY_UI
    if (serverSupportsV4 === false) {
      return ManagerUIState.LEGACY_UI
    }

    // If server feature flags haven't loaded yet, default to NEW_UI
    // This is the safest default since v2 API is the current standard
    if (serverSupportsV4 === undefined) {
      return ManagerUIState.NEW_UI
    }

    // Should never reach here, but if we do, disable manager
    return ManagerUIState.DISABLED
  }

  /**
   * Helper function to check if manager is enabled (not DISABLED)
   */
  const isManagerEnabled = (): boolean => {
    return getManagerUIState() !== ManagerUIState.DISABLED
  }

  /**
   * Helper function to check if manager UI is in NEW_UI mode
   */
  const isNewManagerUI = (): boolean => {
    return getManagerUIState() === ManagerUIState.NEW_UI
  }

  /**
   * Helper function to check if manager UI is in LEGACY_UI mode
   */
  const isLegacyManagerUI = (): boolean => {
    return getManagerUIState() === ManagerUIState.LEGACY_UI
  }

  /**
   * Helper function to check if install button should be shown
   * (only in NEW_UI mode)
   */
  const shouldShowInstallButton = (): boolean => {
    return isNewManagerUI()
  }

  /**
   * Helper function to check if manager buttons should be shown
   * (when manager is not disabled)
   */
  const shouldShowManagerButtons = (): boolean => {
    return isManagerEnabled()
  }

  return {
    getManagerUIState,
    isManagerEnabled,
    isNewManagerUI,
    isLegacyManagerUI,
    shouldShowInstallButton,
    shouldShowManagerButtons
  }
})
