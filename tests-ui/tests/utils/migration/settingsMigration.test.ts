import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'
import { useSettingStore } from '@/stores/settingStore'
import {
  SETTING_MIGRATIONS,
  runSettingMigrations
} from '@/utils/migration/settingsMigration'

// Mock the api
vi.mock('@/scripts/api', () => ({
  api: {
    getSettings: vi.fn(),
    storeSetting: vi.fn()
  }
}))

// Mock the app
vi.mock('@/scripts/app', () => ({
  app: {
    ui: {
      settings: {
        dispatchChange: vi.fn()
      }
    }
  }
}))

describe('settingsMigration', () => {
  let store: ReturnType<typeof useSettingStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSettingStore()
    vi.clearAllMocks()

    // Mock the store methods to avoid needing registered settings
    vi.spyOn(store, 'set').mockImplementation(async (key, value) => {
      store.settingValues[key] = value
      await api.storeSetting(key, value)
    })

    vi.spyOn(store, 'get').mockImplementation((key) => {
      return store.settingValues[key]
    })

    vi.spyOn(store, 'exists').mockImplementation((key) => {
      return key in store.settingValues
    })
  })

  describe('Comfy.UseNewMenu migration', () => {
    it('should migrate "Floating" value to "Top"', async () => {
      // Setup initial state with old value
      store.settingValues = { 'Comfy.UseNewMenu': 'Floating' }

      // Check condition
      const migration = SETTING_MIGRATIONS[0]
      expect(migration.condition()).toBe(true)

      // Run migration
      await migration.migrate()

      // Verify the value was updated
      expect(store.settingValues['Comfy.UseNewMenu']).toBe('Top')
      expect(api.storeSetting).toHaveBeenCalledWith('Comfy.UseNewMenu', 'Top')
    })

    it('should not migrate when value is not "Floating"', () => {
      // Setup with different value
      store.settingValues = { 'Comfy.UseNewMenu': 'Bottom' }

      // Check condition
      const migration = SETTING_MIGRATIONS[0]
      expect(migration.condition()).toBe(false)
    })

    it('should not migrate when setting does not exist', () => {
      // No settings
      store.settingValues = {}

      // Check condition
      const migration = SETTING_MIGRATIONS[0]
      expect(migration.condition()).toBe(false)
    })
  })

  describe('Comfy.Keybinding.UnsetBindings migration', () => {
    it('should migrate targetSelector to targetElementId', async () => {
      // Setup with old format
      store.settingValues = {
        'Comfy.Keybinding.UnsetBindings': [
          { targetSelector: '#graph-canvas', key: 'a' },
          { targetSelector: '#other', key: 'b' }
        ]
      }

      // Check condition
      const migration = SETTING_MIGRATIONS[1]
      expect(migration.condition()).toBe(true)

      // Run migration
      await migration.migrate()

      // Verify the migration
      const result = store.settingValues['Comfy.Keybinding.UnsetBindings']
      expect(result).toEqual([
        { targetElementId: 'graph-canvas', key: 'a' },
        { targetSelector: '#other', key: 'b' } // Only #graph-canvas is migrated
      ])
      expect(api.storeSetting).toHaveBeenCalledWith(
        'Comfy.Keybinding.UnsetBindings',
        result
      )
    })

    it('should delete targetSelector property after migration', async () => {
      // Setup with old format
      store.settingValues = {
        'Comfy.Keybinding.UnsetBindings': [
          { targetSelector: '#graph-canvas', key: 'a' }
        ]
      }

      // Run migration
      await SETTING_MIGRATIONS[1].migrate()

      // Verify targetSelector is deleted and targetElementId is added
      const result = store.settingValues['Comfy.Keybinding.UnsetBindings'][0]
      expect(result).not.toHaveProperty('targetSelector')
      expect(result).toHaveProperty('targetElementId', 'graph-canvas')
      expect(result).toHaveProperty('key', 'a')
    })

    it('should not migrate when all keybindings use new format', () => {
      // Setup with new format
      store.settingValues = {
        'Comfy.Keybinding.UnsetBindings': [
          { targetElementId: 'graph-canvas', key: 'a' }
        ]
      }

      // Check condition
      const migration = SETTING_MIGRATIONS[1]
      expect(migration.condition()).toBe(false)
    })

    it('should not migrate when setting does not exist', () => {
      // No settings
      store.settingValues = {}

      // Check condition
      const migration = SETTING_MIGRATIONS[1]
      expect(migration.condition()).toBe(false)
    })

    it('should handle empty keybindings array', () => {
      // Empty array
      store.settingValues = { 'Comfy.Keybinding.UnsetBindings': [] }

      // Check condition
      const migration = SETTING_MIGRATIONS[1]
      expect(migration.condition()).toBe(false)
    })
  })

  describe('Comfy.ColorPalette migration', () => {
    it('should remove "custom_" prefix', async () => {
      // Setup with old format
      store.settingValues = { 'Comfy.ColorPalette': 'custom_mytheme' }

      // Check condition
      const migration = SETTING_MIGRATIONS[2]
      expect(migration.condition()).toBe(true)

      // Run migration
      await migration.migrate()

      // Verify the migration
      expect(store.settingValues['Comfy.ColorPalette']).toBe('mytheme')
      expect(api.storeSetting).toHaveBeenCalledWith(
        'Comfy.ColorPalette',
        'mytheme'
      )
    })

    it('should not migrate when value does not start with "custom_"', () => {
      // Setup with value that doesn't need migration
      store.settingValues = { 'Comfy.ColorPalette': 'dark' }

      // Check condition
      const migration = SETTING_MIGRATIONS[2]
      expect(migration.condition()).toBe(false)
    })

    it('should not migrate when setting does not exist', () => {
      // No settings
      store.settingValues = {}

      // Check condition
      const migration = SETTING_MIGRATIONS[2]
      expect(migration.condition()).toBe(false)
    })
  })

  describe('runSettingMigrations', () => {
    it('should run all applicable migrations', async () => {
      // Setup state that triggers all migrations
      store.settingValues = {
        'Comfy.UseNewMenu': 'Floating',
        'Comfy.Keybinding.UnsetBindings': [
          { targetSelector: '#graph-canvas', key: 'a' }
        ],
        'Comfy.ColorPalette': 'custom_mytheme'
      }

      // Run all migrations
      await runSettingMigrations()

      // Verify all migrations ran
      expect(store.settingValues['Comfy.UseNewMenu']).toBe('Top')
      expect(store.settingValues['Comfy.Keybinding.UnsetBindings']).toEqual([
        { targetElementId: 'graph-canvas', key: 'a' }
      ])
      expect(store.settingValues['Comfy.ColorPalette']).toBe('mytheme')

      // Verify all API calls were made
      expect(api.storeSetting).toHaveBeenCalledTimes(3)
    })

    it('should only run migrations that meet their conditions', async () => {
      // Setup state that only triggers one migration
      store.settingValues = {
        'Comfy.UseNewMenu': 'Bottom', // Won't migrate
        'Comfy.ColorPalette': 'custom_mytheme' // Will migrate
      }

      // Run migrations
      await runSettingMigrations()

      // Verify only one migration ran
      expect(store.settingValues['Comfy.UseNewMenu']).toBe('Bottom')
      expect(store.settingValues['Comfy.ColorPalette']).toBe('mytheme')

      // Only one API call
      expect(api.storeSetting).toHaveBeenCalledTimes(1)
      expect(api.storeSetting).toHaveBeenCalledWith(
        'Comfy.ColorPalette',
        'mytheme'
      )
    })

    it('should handle no migrations needed', async () => {
      // Setup state that doesn't trigger any migrations
      store.settingValues = {
        'Comfy.UseNewMenu': 'Top',
        'Comfy.Keybinding.UnsetBindings': [
          { targetElementId: 'graph-canvas', key: 'a' }
        ],
        'Comfy.ColorPalette': 'dark'
      }

      // Run migrations
      await runSettingMigrations()

      // No API calls should be made
      expect(api.storeSetting).not.toHaveBeenCalled()
    })
  })
})
