import type { Keybinding } from '@/schemas/keyBindingSchema'
import { useSettingStore } from '@/stores/settingStore'

export interface SettingMigration {
  condition: () => boolean
  migrate: () => Promise<void>
}

/**
 * Setting value migrations that transform deprecated values to new formats.
 * These run after settings are loaded from the server but before they are
 * registered, ensuring settings have valid values when the app initializes.
 */
export const SETTING_MIGRATIONS: SettingMigration[] = [
  // Migrate Comfy.UseNewMenu "Floating" value to "Top"
  {
    condition: () => {
      const settingStore = useSettingStore()
      return (
        settingStore.exists('Comfy.UseNewMenu') &&
        (settingStore.get('Comfy.UseNewMenu') as string) === 'Floating'
      )
    },
    migrate: async () => {
      const settingStore = useSettingStore()
      await settingStore.set('Comfy.UseNewMenu', 'Top')
    }
  },
  // Migrate Comfy.Keybinding.UnsetBindings targetSelector to targetElementId
  {
    condition: () => {
      const settingStore = useSettingStore()
      if (!settingStore.exists('Comfy.Keybinding.UnsetBindings')) return false
      const keybindings = settingStore.get(
        'Comfy.Keybinding.UnsetBindings'
      ) as Keybinding[]
      return keybindings.some((kb: any) => 'targetSelector' in kb)
    },
    migrate: async () => {
      const settingStore = useSettingStore()
      const keybindings = settingStore.get(
        'Comfy.Keybinding.UnsetBindings'
      ) as any[]
      const migrated = keybindings.map((keybinding) => {
        if (keybinding['targetSelector'] === '#graph-canvas') {
          keybinding['targetElementId'] = 'graph-canvas'
          delete keybinding['targetSelector']
        }
        return keybinding
      })
      await settingStore.set('Comfy.Keybinding.UnsetBindings', migrated)
    }
  },
  // Migrate Comfy.ColorPalette custom_ prefix
  {
    condition: () => {
      const settingStore = useSettingStore()
      return (
        settingStore.exists('Comfy.ColorPalette') &&
        (settingStore.get('Comfy.ColorPalette') as string).startsWith('custom_')
      )
    },
    migrate: async () => {
      const settingStore = useSettingStore()
      const value = settingStore.get('Comfy.ColorPalette') as string
      await settingStore.set('Comfy.ColorPalette', value.replace('custom_', ''))
    }
  }
]

/**
 * Runs all setting migrations that meet their conditions.
 * This is called after loadSettingValues() to ensure all deprecated
 * setting values are migrated to their current format before the
 * application starts using them.
 */
export async function runSettingMigrations(): Promise<void> {
  for (const migration of SETTING_MIGRATIONS) {
    if (migration.condition()) {
      await migration.migrate()
    }
  }
}
