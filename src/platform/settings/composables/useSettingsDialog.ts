import type { Component } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useDialogStore } from '@/stores/dialogStore'

import type {
  SettingDialogProps,
  SettingPanelType
} from '@/platform/settings/types'

const DIALOG_KEY = 'global-settings'

let navigationRequestCount = 0

function nextNavigationRequest(
  panel: SettingPanelType | undefined,
  settingId: string | undefined
): Partial<SettingDialogProps> | undefined {
  if (!panel && !settingId) return undefined
  navigationRequestCount += 1
  return {
    navigationRequestId: navigationRequestCount,
    ...(panel ? { defaultPanel: panel } : {}),
    ...(settingId ? { scrollToSettingId: settingId } : {})
  }
}

// The redesigned Settings dialog is 1280px wide (DES 3253-16079).
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
    const destination = nextNavigationRequest(panel, settingId)
    if (destination && dialogStore.isDialogOpen(DIALOG_KEY)) {
      dialogStore.updateDialog({
        key: DIALOG_KEY,
        contentProps: destination
      })
    }
    dialogStore.showDialog({
      key: DIALOG_KEY,
      component: settingDialogComponent,
      props: {
        onClose: hide,
        ...destination
      },
      dialogComponentProps: {
        headless: true,
        closable: true
      }
    })
  }

  function showAbout() {
    show('about')
  }

  return { show, hide, showAbout }
}
