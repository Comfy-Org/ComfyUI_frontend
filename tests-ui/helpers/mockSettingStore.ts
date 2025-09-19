import { vi } from 'vitest'

import type { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/schemas/apiSchema'

/**
 * Creates a mock setting store with properly typed get method.
 * @param getImplementation - Custom implementation for the get method
 * @returns Partial mock of the setting store
 */
export function createMockSettingStore(
  getImplementation?: <K extends keyof Settings>(key: K) => Settings[K]
): Partial<ReturnType<typeof useSettingStore>> {
  const defaultGet = <K extends keyof Settings>(_key: K): Settings[K] => {
    // Default implementation returns undefined for any key
    return undefined as Settings[K]
  }

  return {
    get: vi.fn(getImplementation ?? defaultGet)
  }
}

/**
 * Creates a mock setting store with specific key-value pairs.
 * @param settings - Object with setting keys and their values
 * @returns Partial mock of the setting store
 */
export function createMockSettingStoreWithValues(
  settings: Partial<Settings>
): Partial<ReturnType<typeof useSettingStore>> {
  return createMockSettingStore(
    <K extends keyof Settings>(key: K): Settings[K] => {
      if (key in settings) {
        return settings[key as keyof typeof settings] as Settings[K]
      }
      return undefined as Settings[K]
    }
  )
}
