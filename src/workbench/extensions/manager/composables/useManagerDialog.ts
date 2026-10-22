import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useDialogService } from '@/services/dialogService'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import {
  ManagerUIState,
  getManagerUIState,
  showIncompatibleManagerToast
} from '@/workbench/extensions/manager/composables/useManagerState'
import type { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import ManagerDialog from '@/workbench/extensions/manager/components/manager/ManagerDialog.vue'

const DIALOG_KEY = 'global-manager'

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
      }
    })
  }

  async function openManager(options?: OpenManagerOptions): Promise<void> {
    const managerUIState = getManagerUIState()
    const settingsDialog = useSettingsDialog()

    switch (managerUIState) {
      case ManagerUIState.DISABLED:
        settingsDialog.show('extension')
        break

      case ManagerUIState.INCOMPATIBLE:
        showIncompatibleManagerToast({ force: true })
        break

      case ManagerUIState.LEGACY_UI: {
        const command =
          options?.legacyCommand || 'Comfy.Manager.Menu.ToggleVisibility'
        try {
          await useCommandStore().execute(command)
        } catch {
          if (options?.showToastOnLegacyError !== false) {
            useToast().error(t('g.error'), {
              description: t('manager.legacyMenuNotAvailable')
            })
          } else {
            settingsDialog.show('extension')
          }
        }
        break
      }

      case ManagerUIState.NEW_UI:
        if (options?.isLegacyOnly) {
          useToast().error(t('g.error'), {
            description: t('manager.legacyMenuNotAvailable')
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
