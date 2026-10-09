import type { Component } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useDialogStore } from '@/stores/dialogStore'

import type {
  SettingDialogProps,
  SettingPanelType
} from '@/platform/settings/types'

const DIALOG_KEY = 'global-settings'

// The redesigned Settings dialog is 1280px wide (DES 3253-16079).
const SETTINGS_CONTENT_CLASS =
  'w-[90vw] max-w-[1280px] sm:max-w-[1280px] h-[80vh] max-h-none rounded-2xl overflow-hidden'

let settingDialogComponent: Component<SettingDialogProps> | undefined

/**
 * The settings dialog subtree opens the settings dialog itself (billing
 * stores, top-up dialogs, confirmation content), so the composable cannot
 * import the component without an import cycle. The app shell registers it.
 */
export function registerSettingDialogComponent(
  component: Component<SettingDialogProps>
) {
  settingDialogComponent = component
}

export function useSettingsDialog() {
  const dialogStore = useDialogStore()

  function hide() {
    dialogStore.closeDialog({ key: DIALOG_KEY })
  }

  function show(panel?: SettingPanelType, settingId?: string) {
    if (!settingDialogComponent) {
      reportError(new Error('Setting dialog component is not registered'), {
        errorType: 'failure_opening_settings_dialog',
        surface: 'platform'
      })
      return
    }
    dialogStore.showDialog({
      key: DIALOG_KEY,
      component: settingDialogComponent,
      props: {
        onClose: hide,
        ...(panel ? { defaultPanel: panel } : {}),
        ...(settingId ? { scrollToSettingId: settingId } : {})
      },
      dialogComponentProps: {
        headless: true,
        closable: true,
        size: 'full',
        contentClass: SETTINGS_CONTENT_CLASS,
        overlayClass: isCloud ? 'p-8' : undefined
      }
    })
  }

  function showAbout() {
    show('about')
  }

  return { show, hide, showAbout }
}
