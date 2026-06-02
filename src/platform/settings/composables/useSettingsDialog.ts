import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

import SettingDialog from '@/platform/settings/components/SettingDialog.vue'
import type { SettingPanelType } from '@/platform/settings/types'

const DIALOG_KEY = 'global-settings'

const SETTINGS_CONTENT_CLASS =
  'w-[90vw] max-w-[960px] sm:max-w-[960px] h-[80vh] max-h-none rounded-2xl overflow-hidden'

export function useSettingsDialog() {
  const dialogService = useDialogService()
  const dialogStore = useDialogStore()
  const { flags } = useFeatureFlags()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(panel?: SettingPanelType, settingId?: string) {
    const isWorkspaceMode = isCloud && flags.teamWorkspacesEnabled
    dialogService.showLayoutDialog({
      key: DIALOG_KEY,
      component: SettingDialog,
      props: {
        onClose: hide,
        ...(panel ? { defaultPanel: panel } : {}),
        ...(settingId ? { scrollToSettingId: settingId } : {})
      },
      dialogComponentProps: {
        // Settings hosts nested PrimeVue dialogs (Edit Keybinding, Overwrite
        // confirm, etc.) that teleport to body. Reka's modal mode traps focus
        // inside the Settings content and disables body pointer-events, which
        // breaks those nested dialogs' autofocus and click handling. Non-modal
        // keeps the visual overlay without those traps.
        modal: false,
        size: 'full',
        contentClass: SETTINGS_CONTENT_CLASS,
        overlayClass: isWorkspaceMode ? 'p-8' : undefined
      }
    })
  }

  function showAbout() {
    show('about')
  }

  return { show, hide, showAbout }
}
