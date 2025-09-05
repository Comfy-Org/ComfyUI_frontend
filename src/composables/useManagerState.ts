import { t } from '@/i18n'
import { api } from '@/scripts/api'
import { useDialogService } from '@/services/dialogService'
import { useCommandStore } from '@/stores/commandStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { useToastStore } from '@/stores/toastStore'
import { ManagerTab } from '@/types/comfyManagerTypes'

export enum ManagerUIState {
  DISABLED = 'disabled',
  LEGACY_UI = 'legacy',
  NEW_UI = 'new'
}

export function useManagerState() {
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
    // This is a temporary state - feature flags are exchanged immediately on WebSocket connection
    // NEW_UI is the safest default since v2 API is the current standard
    // If the server doesn't support v2, API calls will fail with 404 and be handled gracefully
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

  /**
   * Opens the manager UI based on current state
   * Centralizes the logic for opening manager across the app
   * @param options - Optional configuration for opening the manager
   * @param options.initialTab - Initial tab to show (for NEW_UI mode)
   * @param options.legacyCommand - Legacy command to execute (for LEGACY_UI mode)
   * @param options.showToastOnLegacyError - Whether to show toast on legacy command failure
   * @param options.isLegacyOnly - If true, shows error in NEW_UI mode instead of opening manager
   */
  const openManager = async (options?: {
    initialTab?: ManagerTab
    legacyCommand?: string
    showToastOnLegacyError?: boolean
    isLegacyOnly?: boolean
  }): Promise<void> => {
    const state = getManagerUIState()
    const dialogService = useDialogService()
    const commandStore = useCommandStore()

    switch (state) {
      case ManagerUIState.DISABLED:
        dialogService.showSettingsDialog('extension')
        break

      case ManagerUIState.LEGACY_UI: {
        const command =
          options?.legacyCommand || 'Comfy.Manager.Menu.ToggleVisibility'
        try {
          await commandStore.execute(command)
        } catch {
          // If legacy command doesn't exist
          if (options?.showToastOnLegacyError !== false) {
            useToastStore().add({
              severity: 'error',
              summary: t('g.error'),
              detail: t('manager.legacyMenuNotAvailable'),
              life: 3000
            })
          }
          // Fallback to extensions panel if not showing toast
          if (options?.showToastOnLegacyError === false) {
            dialogService.showSettingsDialog('extension')
          }
        }
        break
      }

      case ManagerUIState.NEW_UI:
        if (options?.isLegacyOnly) {
          // Legacy command is not available in NEW_UI mode
          useToastStore().add({
            severity: 'error',
            summary: t('g.error'),
            detail: t('manager.legacyMenuNotAvailable'),
            life: 3000
          })
        } else {
          dialogService.showManagerDialog(
            options?.initialTab ? { initialTab: options.initialTab } : undefined
          )
        }
        break
    }
  }

  return {
    getManagerUIState,
    isManagerEnabled,
    isNewManagerUI,
    isLegacyManagerUI,
    shouldShowInstallButton,
    shouldShowManagerButtons,
    openManager
  }
}
