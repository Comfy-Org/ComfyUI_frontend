import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import { useDialogService } from '@/services/dialogService'
import { useDialogStore } from '@/stores/dialogStore'

import SettingDialog from '@/platform/settings/components/SettingDialog.vue'
import type { SettingPanelType } from '@/platform/settings/types'

const DIALOG_KEY = 'global-settings'

// The redesigned Settings dialog is 1280px wide (DES 3253-16079).
const SETTINGS_CONTENT_CLASS =
  'w-[90vw] max-w-[1280px] sm:max-w-[1280px] h-[80vh] max-h-none rounded-2xl overflow-hidden'

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
        renderer: 'reka',
        // Settings hosts nested PrimeVue dialogs (Edit Keybinding, Overwrite
        // confirm, etc.) that teleport to body. Reka's modal mode traps focus
        // inside the Settings content and disables body pointer-events, which
        // breaks those nested dialogs' autofocus and click handling. Non-modal
        // keeps the visual overlay without those traps.
        modal: false,
        // A nested dialog closing (e.g. confirming a Secrets delete) can move
        // focus onto an app element once the row it focused is removed. As a
        // non-modal dialog Settings would treat that as an outside focus and
        // dismiss itself, so opt out — escape and outside clicks still close it.
        dismissOnFocusOutside: false,
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
