import { t } from '@/i18n'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useDialogService } from '@/services/dialogService'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import {
  ManagerUIState,
  showIncompatibleManagerToast,
  useManagerState
} from '@/workbench/extensions/manager/composables/useManagerState'
import type { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import ManagerDialog from '@/workbench/extensions/manager/components/manager/ManagerDialog.vue'

const DIALOG_KEY = 'global-manager'

const MANAGER_CONTENT_CLASS =
  'w-[90vw] max-w-[1724px] sm:max-w-[1724px] h-[80vh] max-h-[1026px] min-[3000px]:max-w-[2200px] min-[3000px]:max-h-[1320px] rounded-2xl overflow-hidden'

interface OpenManagerOptions {
  initialTab?: ManagerTab
  initialPackId?: string
  legacyCommand?: string
  showToastOnLegacyError?: boolean
  isLegacyOnly?: boolean
}

export function useManagerDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(initialTab?: ManagerTab, initialPackId?: string) {
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: ManagerDialog,
      props: {
        onClose: hide,
        initialTab,
        initialPackId
      },
      dialogComponentProps: {
        renderer: 'reka',
        // Manager hosts PrimeVue overlays (SingleSelect, SearchAutocomplete)
        // teleported to body. Reka's modal mode traps focus and disables body
        // pointer-events, breaking those overlays. Mirrors Settings.
        modal: false,
        size: 'full',
        contentClass: MANAGER_CONTENT_CLASS
      }
    })
  }

  /**
   * Opens the manager UI appropriate for the current {@link ManagerUIState}.
   * @param options.initialTab - Initial tab to show (NEW_UI)
   * @param options.legacyCommand - Command to execute (LEGACY_UI)
   * @param options.showToastOnLegacyError - Toast when the legacy command fails
   * @param options.isLegacyOnly - Show an error in NEW_UI instead of opening
   */
  async function openManager(options?: OpenManagerOptions): Promise<void> {
    const { managerUIState } = useManagerState()
    const settingsDialog = useSettingsDialog()

    switch (managerUIState.value) {
      case ManagerUIState.DISABLED:
        settingsDialog.show('extension')
        break

      case ManagerUIState.INCOMPATIBLE:
        // Explicit user action re-surfaces guidance instead of redirecting
        // into settings like DISABLED does.
        showIncompatibleManagerToast({ force: true })
        break

      case ManagerUIState.LEGACY_UI: {
        const command =
          options?.legacyCommand || 'Comfy.Manager.Menu.ToggleVisibility'
        try {
          await useCommandStore().execute(command)
        } catch {
          if (options?.showToastOnLegacyError !== false) {
            useToastStore().add({
              severity: 'error',
              summary: t('g.error'),
              detail: t('manager.legacyMenuNotAvailable')
            })
          } else {
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
          show(options?.initialTab, options?.initialPackId)
        }
        break
    }
  }

  return {
    show,
    hide,
    openManager
  }
}
