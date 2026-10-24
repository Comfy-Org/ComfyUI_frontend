import type { Component } from 'vue'
import { readonly, ref } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'
import { useDialogStore } from '@/stores/dialogStore'

import type {
  ExtensionFilterType,
  SettingDialogProps,
  SettingPanelType
} from '@/platform/settings/types'

const DIALOG_KEY = 'global-settings'

export interface SettingsPanelNavigation {
  panel: SettingPanelType
  extensionFilter?: ExtensionFilterType
  requestId: number
}

const navigation = ref<SettingsPanelNavigation>()
let lastRequestId = 0

export const settingsPanelNavigation = readonly(navigation)

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
        closable: true
      }
    })
  }

  function showAbout() {
    show('about')
  }

  return { show, hide, showAbout }
}

export function showSettingsPanel(
  panel: SettingPanelType,
  options: Pick<SettingsPanelNavigation, 'extensionFilter'> = {}
) {
  navigation.value = { ...options, panel, requestId: ++lastRequestId }
  useSettingsDialog().show(panel)
}

export function consumeSettingsPanelNavigation(requestId: number) {
  if (navigation.value?.requestId === requestId) navigation.value = undefined
}
