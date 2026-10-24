import { vi } from 'vitest'
import { readonly, ref } from 'vue'

import type {
  SettingsPanelNavigation,
  useSettingsDialog as realUseSettingsDialog
} from '@/platform/settings/composables/useSettingsDialog'

const settingsDialog: ReturnType<typeof realUseSettingsDialog> = {
  show: vi.fn(),
  hide: vi.fn(),
  showAbout: vi.fn()
}

export const useSettingsDialog = vi.fn(() => settingsDialog)

export const settingsPanelNavigation = readonly(ref<SettingsPanelNavigation>())
export const showSettingsPanel = vi.fn()
export const consumeSettingsPanelNavigation = vi.fn()
