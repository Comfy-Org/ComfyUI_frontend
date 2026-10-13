import { useDialogStore } from '@/stores/dialogStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())

import {
  registerSettingDialogComponent,
  useSettingsDialog
} from '@/platform/settings/composables/useSettingsDialog'

const SettingDialogStub = { name: 'SettingDialogStub' }

beforeEach(() => {
  useDialogStore().showDialog = showDialog
  vi.mocked(useDialogStore().closeDialog).mockImplementation(() => undefined)
  registerSettingDialogComponent(SettingDialogStub)
})

describe('useSettingsDialog', () => {
  it('show() opens the registered dialog component', () => {
    useSettingsDialog().show()
    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('global-settings')
    expect(args.component).toBe(SettingDialogStub)
  })

  it('show(panel) forwards defaultPanel to the dialog props', () => {
    useSettingsDialog().show('about')
    const [args] = showDialog.mock.calls[0]
    expect(args.props.defaultPanel).toBe('about')
  })

  it('showAbout() opens the about panel', () => {
    useSettingsDialog().showAbout()
    const [args] = showDialog.mock.calls[0]
    expect(args.props.defaultPanel).toBe('about')
  })
})
