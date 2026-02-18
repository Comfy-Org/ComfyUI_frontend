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

describe('Comfy.Workflow.Persist defaultsByInstallVersion', () => {
  let settingStore: ReturnType<typeof useSettingStore>

  const persistSetting = CORE_SETTINGS.find(
    (s) => s.id === 'Comfy.Workflow.Persist'
  )!

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    settingStore = useSettingStore()
    vi.clearAllMocks()
  })

  it('should have defaultValue true', () => {
    expect(persistSetting.defaultValue).toBe(true)
  })

  it('should have defaultsByInstallVersion entry for 1.40.7', () => {
    expect(persistSetting.defaultsByInstallVersion).toEqual({
      '1.40.7': false
    })
  })

  it('should default to true for existing users with no installed version', () => {
    settingStore.addSetting(persistSetting)

    expect(settingStore.get('Comfy.Workflow.Persist')).toBe(true)
  })

  it('should default to true for existing users with older installed version', () => {
    settingStore.settingValues['Comfy.InstalledVersion'] = '1.30.0'
    settingStore.addSetting(persistSetting)

    expect(settingStore.get('Comfy.Workflow.Persist')).toBe(true)
  })

  it('should default to false for fresh installs on 1.40.7', () => {
    settingStore.settingValues['Comfy.InstalledVersion'] = '1.40.7'
    settingStore.addSetting(persistSetting)

    expect(settingStore.get('Comfy.Workflow.Persist')).toBe(false)
  })

  it('should default to false for fresh installs on versions after 1.40.7', () => {
    settingStore.settingValues['Comfy.InstalledVersion'] = '1.50.0'
    settingStore.addSetting(persistSetting)

    expect(settingStore.get('Comfy.Workflow.Persist')).toBe(false)
  })
})

describe('Comfy.Workflow.AutoSave onChange', () => {
  let settingStore: ReturnType<typeof useSettingStore>
  let dialogStore: ReturnType<typeof useDialogStore>

  const persistSetting = CORE_SETTINGS.find(
    (s) => s.id === 'Comfy.Workflow.Persist'
  )!
  const autoSaveSetting = CORE_SETTINGS.find(
    (s) => s.id === 'Comfy.Workflow.AutoSave'
  )!

  async function triggerAutoSaveOff() {
    await settingStore.set('Comfy.Workflow.AutoSave', 'after delay')
    await settingStore.set('Comfy.Workflow.AutoSave', 'off')
  }

  function getFooterProps() {
    const dialog = dialogStore.dialogStack[0]
    return dialog.footerProps as Record<string, (() => void) | undefined>
  }

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    settingStore = useSettingStore()
    dialogStore = useDialogStore()
    vi.clearAllMocks()

    settingStore.addSetting(persistSetting)
    settingStore.addSetting(autoSaveSetting)
  })

  it('should show confirm dialog when setting AutoSave to off while Persist is enabled', async () => {
    await triggerAutoSaveOff()

    expect(dialogStore.dialogStack).toHaveLength(1)
  })

  it('should not show dialog when Persist is already disabled', async () => {
    await settingStore.set('Comfy.Workflow.Persist', false)
    await triggerAutoSaveOff()

    expect(dialogStore.dialogStack).toHaveLength(0)
  })

  it('should disable Persist when user confirms', async () => {
    await triggerAutoSaveOff()

    getFooterProps().onConfirm!()

    expect(settingStore.get('Comfy.Workflow.Persist')).toBe(false)
  })

  it('should keep Persist when user clicks secondary action', async () => {
    await triggerAutoSaveOff()

    getFooterProps().onCancel!()

    expect(settingStore.get('Comfy.Workflow.Persist')).toBe(true)
  })

  it('should disable Persist when dialog is dismissed', async () => {
    await triggerAutoSaveOff()

    const dialog = dialogStore.dialogStack[0]
    dialog.dialogComponentProps.onClose?.()

    expect(settingStore.get('Comfy.Workflow.Persist')).toBe(false)
  })

  it('should not show dialog on initial registration (old === undefined)', () => {
    expect(dialogStore.dialogStack).toHaveLength(0)
  })
})
