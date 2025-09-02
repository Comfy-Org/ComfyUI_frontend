import SettingDialogContent from '@/components/dialog/content/SettingDialogContent.vue'
import SettingDialogHeader from '@/components/dialog/header/SettingDialogHeader.vue'
import { useDialogService } from '@/services/dialogService'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import {
  ManagerUIState,
  useManagerStateStore
} from '@/stores/managerStateStore'
import type { ManagerTab } from '@/types/comfyManagerTypes'

/**
 * Options for opening the Manager
 */
export interface OpenManagerOptions {
  /**
   * Initial tab to show when opening the Manager (NEW_UI only)
   */
  initialTab?: ManagerTab
}

/**
 * Opens the Manager UI based on the current state (NEW_UI, LEGACY_UI, or DISABLED)
 * This is the single entry point for opening the Manager from anywhere in the app
 */
export async function openManager(options?: OpenManagerOptions): Promise<void> {
  const managerStateStore = useManagerStateStore()
  const commandStore = useCommandStore()
  const dialogStore = useDialogStore()
  const dialogService = useDialogService()

  const state = managerStateStore.managerUIState
  console.log('[Manager Helper] Opening manager with state:', state)

  switch (state) {
    case ManagerUIState.DISABLED:
      // Show settings dialog with extension tab
      dialogStore.showDialog({
        key: 'global-settings',
        headerComponent: SettingDialogHeader,
        component: SettingDialogContent,
        props: {
          defaultPanel: 'extension'
        }
      })
      break

    case ManagerUIState.LEGACY_UI:
      try {
        // Try legacy manager command directly without causing recursion
        await commandStore.execute('Comfy.Manager.Menu.ToggleVisibility')
      } catch (e) {
        console.warn('[Manager Helper] Legacy manager not available:', e)
        // Show settings as fallback
        dialogStore.showDialog({
          key: 'global-settings',
          headerComponent: SettingDialogHeader,
          component: SettingDialogContent,
          props: {
            defaultPanel: 'extension'
          }
        })
      }
      break

    case ManagerUIState.NEW_UI:
      dialogService.showManagerDialog(options)
      break
  }
}

/**
 * Composable for manager helper functions
 */
export function useManagerHelper() {
  return {
    openManager
  }
}
