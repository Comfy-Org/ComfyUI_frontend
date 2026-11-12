import { beforeEach, describe, expect, it } from 'vitest'

import {
  registerSettingDialogComponent,
  useSettingsDialog
} from '@/platform/settings/composables/useSettingsDialog'
import { useDialogStore } from '@/stores/dialogStore'

const SettingDialogStub = { name: 'SettingDialogStub' }

function liveContentProps() {
  return useDialogStore().dialogStack.find(
    (dialog) => dialog.key === 'global-settings'
  )?.contentProps
}

function requestedPanel() {
  return liveContentProps()?.defaultPanel
}

beforeEach(() => {
  registerSettingDialogComponent(SettingDialogStub)
})

describe('useSettingsDialog panel routing', () => {
  it('opens on the requested panel when Settings is closed', () => {
    useSettingsDialog().show('extension')

    expect(useDialogStore().isDialogOpen('global-settings')).toBe(true)
    expect(requestedPanel()).toBe('extension')
  })

  it('routes an already-open dialog to the requested panel', () => {
    const settingsDialog = useSettingsDialog()
    settingsDialog.showAbout()
    expect(requestedPanel()).toBe('about')

    settingsDialog.show('extension')

    expect(useDialogStore().dialogStack).toHaveLength(1)
    expect(requestedPanel()).toBe('extension')
  })

  it('forwards a setting id to an already-open dialog', () => {
    const settingsDialog = useSettingsDialog()
    settingsDialog.showAbout()

    settingsDialog.show('extension', 'Comfy.Extension.Disabled')

    const dialog = useDialogStore().dialogStack[0]
    expect(dialog.contentProps.defaultPanel).toBe('extension')
    expect(dialog.contentProps.scrollToSettingId).toBe(
      'Comfy.Extension.Disabled'
    )
  })

  it('marks a repeat of the current panel as a fresh navigation request', () => {
    const settingsDialog = useSettingsDialog()
    settingsDialog.show('extension')
    const firstRequestId = liveContentProps()?.navigationRequestId

    settingsDialog.show('extension')

    expect(requestedPanel()).toBe('extension')
    expect(liveContentProps()?.navigationRequestId).toBeGreaterThan(
      Number(firstRequestId)
    )
  })

  it('leaves the current panel alone when no panel is requested', () => {
    const settingsDialog = useSettingsDialog()
    settingsDialog.show('extension')

    settingsDialog.show()

    expect(requestedPanel()).toBe('extension')
  })
})
