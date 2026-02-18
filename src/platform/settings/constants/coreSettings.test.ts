import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock('@/scripts/api', () => ({
  api: {
    getSettings: vi.fn(),
    storeSetting: vi.fn(),
    storeSettings: vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    ui: {
      settings: {
        dispatchChange: vi.fn()
      }
    }
  }
}))

describe('Comfy.Workflow.AutoSave onChange', () => {
  let settingStore: ReturnType<typeof useSettingStore>
  let dialogStore: ReturnType<typeof useDialogStore>

  const autoSaveSetting = CORE_SETTINGS.find(
    (s) => s.id === 'Comfy.Workflow.AutoSave'
  )!

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    settingStore = useSettingStore()
    dialogStore = useDialogStore()
    vi.clearAllMocks()

    settingStore.addSetting({
      id: 'Comfy.Workflow.Persist',
      name: 'Persist workflow state and restore on page (re)load',
      type: 'boolean',
      defaultValue: true
    })
    settingStore.addSetting(autoSaveSetting)
  })

  it('should show confirm dialog when setting AutoSave to off while Persist is enabled', async () => {
    await settingStore.set('Comfy.Workflow.AutoSave', 'after delay')
    await settingStore.set('Comfy.Workflow.AutoSave', 'off')

    expect(dialogStore.dialogStack).toHaveLength(1)
  })

  it('should not show dialog when Persist is already disabled', async () => {
    await settingStore.set('Comfy.Workflow.Persist', false)
    await settingStore.set('Comfy.Workflow.AutoSave', 'after delay')
    await settingStore.set('Comfy.Workflow.AutoSave', 'off')

    expect(dialogStore.dialogStack).toHaveLength(0)
  })

  it('should disable Persist when user confirms', async () => {
    await settingStore.set('Comfy.Workflow.AutoSave', 'after delay')
    await settingStore.set('Comfy.Workflow.AutoSave', 'off')

    const dialog = dialogStore.dialogStack[0]
    const footerProps = dialog.footerProps as {
      onConfirm: () => void
      onCancel: () => void
    }
    footerProps.onConfirm()

    expect(settingStore.get('Comfy.Workflow.Persist')).toBe(false)
  })

  it('should keep Persist when user clicks secondary action', async () => {
    await settingStore.set('Comfy.Workflow.AutoSave', 'after delay')
    await settingStore.set('Comfy.Workflow.AutoSave', 'off')

    const dialog = dialogStore.dialogStack[0]
    const footerProps = dialog.footerProps as {
      onConfirm: () => void
      onCancel: () => void
    }
    footerProps.onCancel()

    expect(settingStore.get('Comfy.Workflow.Persist')).toBe(true)
  })

  it('should disable Persist when dialog is dismissed', async () => {
    await settingStore.set('Comfy.Workflow.AutoSave', 'after delay')
    await settingStore.set('Comfy.Workflow.AutoSave', 'off')

    const dialog = dialogStore.dialogStack[0]
    dialog.dialogComponentProps.onClose?.()

    expect(settingStore.get('Comfy.Workflow.Persist')).toBe(false)
  })

  it('should not show dialog on initial registration (old === undefined)', () => {
    expect(dialogStore.dialogStack).toHaveLength(0)
  })
})
