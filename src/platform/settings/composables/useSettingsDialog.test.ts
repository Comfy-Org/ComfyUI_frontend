import { fromPartial } from '@total-typescript/shoehorn'
import type { DialogInstance } from '@/stores/dialogStore'
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

  describe('planCreditsView', () => {
    function openSettingsOnAbout() {
      const dialogStore = useDialogStore()
      dialogStore.dialogStack.push(
        fromPartial<DialogInstance>({
          key: 'global-settings',
          contentProps: { defaultPanel: 'about' },
          dialogComponentProps: {}
        })
      )
      return dialogStore.dialogStack[0]
    }

    it('show(panel) leaves the Plan & Credits view out of the dialog props', () => {
      useSettingsDialog().show('workspace')
      const [args] = showDialog.mock.calls[0]
      expect(args.props).not.toHaveProperty('planCreditsView')
    })

    it('show(panel, settingId, { planCreditsView }) forwards the view to the dialog props', () => {
      useSettingsDialog().show('workspace', undefined, {
        planCreditsView: 'activity'
      })
      const [args] = showDialog.mock.calls[0]
      expect(args.props.defaultPanel).toBe('workspace')
      expect(args.props.planCreditsView).toBe('activity')
    })

    it('applies the view to a settings dialog that is already open', () => {
      const openDialog = openSettingsOnAbout()

      useSettingsDialog().show('workspace', undefined, {
        planCreditsView: 'activity'
      })

      expect(openDialog.contentProps).toMatchObject({
        defaultPanel: 'workspace',
        planCreditsView: 'activity'
      })
    })

    it('adds no view to an already open settings dialog without the option', () => {
      const openDialog = openSettingsOnAbout()

      useSettingsDialog().show('workspace')

      expect(openDialog.contentProps).toMatchObject({
        defaultPanel: 'workspace'
      })
      expect(openDialog.contentProps).not.toHaveProperty('planCreditsView')
    })
  })
})
