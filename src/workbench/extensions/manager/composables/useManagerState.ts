import { storeToRefs } from 'pinia'
import { computed, readonly, watch } from 'vue'

import { t } from '@/i18n'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { useCommandStore } from '@/stores/commandStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { useManagerDialog } from '@/workbench/extensions/manager/composables/useManagerDialog'
import type { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'

export enum ManagerUIState {
  DISABLED = 'disabled',
  LEGACY_UI = 'legacy',
  NEW_UI = 'new',
  INCOMPATIBLE = 'incompatible'
}

/**
 * Module-level flag to ensure the INCOMPATIBLE upgrade toast fires exactly
 * once per app session, even when useManagerState() is invoked from many
 * components. Without this, every consumer would register its own watcher
 * and stack duplicate toasts on the first transition.
 */
let incompatibleToastShown = false

const showIncompatibleToast = (): void => {
  if (incompatibleToastShown) return
  incompatibleToastShown = true
  useToastStore().add({
    severity: 'warn',
    summary: t('manager.incompatibleVersion.title'),
    detail: t('manager.incompatibleVersion.message'),
    life: 15000
  })
}

export function useManagerState() {
  const systemStatsStore = useSystemStatsStore()
  const { systemStats, isInitialized: systemInitialized } =
    storeToRefs(systemStatsStore)
  const managerDialog = useManagerDialog()

  /**
   * The current manager UI state.
   * Computed once and cached until dependencies change (which they don't during runtime).
   * This follows Vue's conventions and provides better performance through caching.
   */
  const managerUIState = readonly(
    computed((): ManagerUIState => {
      // Wait for systemStats to be initialized
      if (!systemInitialized.value) {
        // Default to DISABLED while loading
        return ManagerUIState.DISABLED
      }

      // Get current values
      const clientSupportsV4 =
        api.getClientFeatureFlags().supports_manager_v4_ui ?? false

      const serverSupportsV4 = api.getServerFeature(
        'extension.manager.supports_v4'
      )

      const supportsCsrfPost = api.getServerFeature(
        'extension.manager.supports_csrf_post'
      )

      // Check command line args first (highest priority)
      // --enable-manager flag enables the manager (opposite of old --disable-manager)
      const hasEnableManager =
        systemStats.value?.system?.argv?.includes('--enable-manager')

      // If --enable-manager is NOT present, manager is disabled
      if (!hasEnableManager) {
        return ManagerUIState.DISABLED
      }

      if (
        systemStats.value?.system?.argv?.includes('--enable-manager-legacy-ui')
      ) {
        return ManagerUIState.LEGACY_UI
      }

      // Server exposes v4 but is missing the CSRF-hardened POST endpoints
      // (Manager < 4.2.1). Treat as INCOMPATIBLE — hide manager UI and
      // prompt user to upgrade. csrf_post is an independent axis from v4.
      //
      // !== true (not === false) is deliberate: feature_flags arrive atomically
      // via a single WebSocket payload (src/scripts/api.ts:751-758), so undefined
      // here means the server did not publish the flag (i.e. Manager 4.2.0),
      // not a transient partial-delivery state. Using === false would let
      // flag-less Manager 4.2.0 fall through to NEW_UI → POST → 405 regression.
      if (serverSupportsV4 === true && supportsCsrfPost !== true) {
        return ManagerUIState.INCOMPATIBLE
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
    })
  )

  /**
   * Check if manager is enabled (not DISABLED and not INCOMPATIBLE)
   * INCOMPATIBLE is treated as "not installed" from a UX perspective —
   * the user must upgrade the Manager backend before the UI becomes usable.
   */
  const isManagerEnabled = readonly(
    computed((): boolean => {
      return (
        managerUIState.value !== ManagerUIState.DISABLED &&
        managerUIState.value !== ManagerUIState.INCOMPATIBLE
      )
    })
  )

  /**
   * Check if manager UI is in NEW_UI mode
   */
  const isNewManagerUI = readonly(
    computed((): boolean => {
      return managerUIState.value === ManagerUIState.NEW_UI
    })
  )

  /**
   * Check if manager UI is in LEGACY_UI mode
   */
  const isLegacyManagerUI = readonly(
    computed((): boolean => {
      return managerUIState.value === ManagerUIState.LEGACY_UI
    })
  )

  /**
   * Check if the installed Manager backend is too old to use safely
   * (lacks the CSRF-hardened POST endpoints introduced in Manager 4.2.1).
   */
  const isIncompatibleManager = readonly(
    computed((): boolean => {
      return managerUIState.value === ManagerUIState.INCOMPATIBLE
    })
  )

  /**
   * Check if install button should be shown (only in NEW_UI mode)
   */
  const shouldShowInstallButton = readonly(
    computed((): boolean => {
      return isNewManagerUI.value
    })
  )

  /**
   * Check if manager buttons should be shown.
   * Hidden when DISABLED (flag missing) or INCOMPATIBLE (backend too old).
   */
  const shouldShowManagerButtons = readonly(
    computed((): boolean => {
      return isManagerEnabled.value
    })
  )

  // Fire the upgrade-required toast once when we first observe the
  // INCOMPATIBLE state. immediate: true handles the common case where the
  // composable is mounted after feature flags have already arrived.
  watch(
    managerUIState,
    (state) => {
      if (state === ManagerUIState.INCOMPATIBLE) {
        showIncompatibleToast()
      }
    },
    { immediate: true }
  )

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
    initialPackId?: string
    legacyCommand?: string
    showToastOnLegacyError?: boolean
    isLegacyOnly?: boolean
  }): Promise<void> => {
    const state = managerUIState.value
    const settingsDialog = useSettingsDialog()
    const commandStore = useCommandStore()

    switch (state) {
      case ManagerUIState.DISABLED:
        settingsDialog.show('extension')
        break

      case ManagerUIState.INCOMPATIBLE:
        // Re-emit the upgrade toast on explicit user action. We intentionally
        // bypass the once-per-session guard so repeated clicks on a hidden
        // entry point (e.g. a stale shortcut) still surface guidance,
        // without redirecting into settings like DISABLED does.
        incompatibleToastShown = false
        showIncompatibleToast()
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
              detail: t('manager.legacyMenuNotAvailable')
            })
          }
          // Fallback to extensions panel if not showing toast
          if (options?.showToastOnLegacyError === false) {
            settingsDialog.show('extension')
          }
        }
        break
      }

      case ManagerUIState.NEW_UI:
        if (options?.isLegacyOnly) {
          useToastStore().add({
            severity: 'error',
            summary: t('g.error'),
            detail: t('manager.legacyMenuNotAvailable')
          })
        } else {
          managerDialog.show(options?.initialTab, options?.initialPackId)
        }
        break
    }
  }

  return {
    managerUIState,
    isManagerEnabled,
    isNewManagerUI,
    isLegacyManagerUI,
    isIncompatibleManager,
    shouldShowInstallButton,
    shouldShowManagerButtons,
    openManager
  }
}

// Test-only export: resets the once-per-session toast guard so unit tests
// can assert toast firing across multiple `useManagerState()` invocations.
export const __resetIncompatibleToastGuard = (): void => {
  incompatibleToastShown = false
}
