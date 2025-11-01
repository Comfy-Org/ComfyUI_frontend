import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'

const hoisted = vi.hoisted(() => ({
  trackSettingChanged: vi.fn(),
  storeSetting: vi.fn().mockResolvedValue(undefined)
}))

let isSettingsDialogOpen = false

vi.mock('@/platform/telemetry', () => {
  return {
    useTelemetry: () => ({
      trackSettingChanged: hoisted.trackSettingChanged
    })
  }
})

vi.mock('@/stores/dialogStore', () => {
  return {
    useDialogStore: () => ({
      isDialogOpen: (key: string) =>
        isSettingsDialogOpen && key === 'global-settings'
    })
  }
})

vi.mock('@/scripts/api', () => {
  return {
    api: {
      storeSetting: hoisted.storeSetting,
      getSettings: vi.fn().mockResolvedValue({})
    }
  }
})

vi.mock('@/scripts/app', () => {
  return {
    app: {
      ui: {
        settings: {
          dispatchChange: vi.fn()
        }
      }
    }
  }
})

describe('useSettingStore telemetry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    hoisted.trackSettingChanged.mockReset()
    hoisted.storeSetting.mockReset().mockResolvedValue(undefined)
    isSettingsDialogOpen = false
  })

  it('tracks telemetry when settings dialog is open', async () => {
    isSettingsDialogOpen = true

    const store = useSettingStore()
    store.addSetting({
      id: 'main.sub.setting.name',
      name: 'Test Setting',
      type: 'text',
      defaultValue: 'old'
    })

    await store.set('main.sub.setting.name', 'new')

    expect(hoisted.trackSettingChanged).toHaveBeenCalledTimes(1)
    expect(hoisted.trackSettingChanged).toHaveBeenCalledWith({
      setting_id: 'main.sub.setting.name',
      input_type: 'text',
      category: 'main',
      sub_category: 'sub',
      previous_value: 'old',
      new_value: 'new'
    })
  })

  it('does not track telemetry when settings dialog is closed', async () => {
    isSettingsDialogOpen = false

    const store = useSettingStore()
    store.addSetting({
      id: 'single.setting',
      name: 'Another Setting',
      type: 'text',
      defaultValue: 'x'
    })

    await store.set('single.setting', 'y')

    expect(hoisted.trackSettingChanged).not.toHaveBeenCalled()
  })
})
