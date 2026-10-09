import { useDialogStore } from '@/stores/dialogStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())
const isCloudRef = vi.hoisted(() => ({ value: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return isCloudRef.value
  }
}))

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
  beforeEach(() => {
    isCloudRef.value = false
  })

  it("show() opens at size 'full' with 1280px content sizing", () => {
    useSettingsDialog().show()
    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('global-settings')
    expect(args.dialogComponentProps.size).toBe('full')
    expect(args.dialogComponentProps.contentClass).toContain('max-w-[1280px]')
    expect(args.dialogComponentProps.contentClass).not.toContain(
      'max-w-[960px]'
    )
    expect(args.dialogComponentProps.contentClass).toContain('h-[80vh]')
  })

  it('show() omits overlayClass when not in workspace mode', () => {
    useSettingsDialog().show()
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.overlayClass).toBeUndefined()
  })

  it("show() sets overlayClass 'p-8' on Cloud", () => {
    isCloudRef.value = true

    useSettingsDialog().show()
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.overlayClass).toBe('p-8')
  })

  it('show() opens the registered dialog component', () => {
    useSettingsDialog().show()
    const [args] = showDialog.mock.calls[0]
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
