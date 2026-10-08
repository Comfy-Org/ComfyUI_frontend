import { vi } from 'vitest'

import type { useSettingsDialog as realUseSettingsDialog } from '../useSettingsDialog'

const settingsDialog: ReturnType<typeof realUseSettingsDialog> = {
  show: vi.fn(),
  hide: vi.fn(),
  showAbout: vi.fn()
}

export const useSettingsDialog = vi.fn(() => settingsDialog)
