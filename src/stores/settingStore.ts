import _ from 'lodash'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { Settings } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { SettingParams } from '@/types/settingTypes'
import type { TreeNode } from '@/types/treeExplorerTypes'
import { runSettingMigrations } from '@/utils/migration/settingsMigration'

export const getSettingInfo = (setting: SettingParams) => {
  const parts = setting.category || setting.id.split('.')
  return {
    category: parts[0] ?? 'Other',
    subCategory: parts[1] ?? 'Other'
  }
}

export interface SettingTreeNode extends TreeNode {
  data?: SettingParams
}

function onChange(setting: SettingParams, newValue: any, oldValue: any) {
  if (setting?.onChange) {
    setting.onChange(newValue, oldValue)
  }
  // Backward compatibility with old settings dialog.
  // Some extensions still listens event emitted by the old settings dialog.
  app.ui.settings.dispatchChange(setting.id, newValue, oldValue)
}

export const useSettingStore = defineStore('setting', () => {
  const settingValues = ref<Record<string, any>>({})
  const settingsById = ref<Record<string, SettingParams>>({})

  /**
   * Check if a setting's value exists, i.e. if the user has set it manually.
   * @param key - The key of the setting to check.
   * @returns Whether the setting exists.
   */
  function exists(key: string) {
    return settingValues.value[key] !== undefined
  }

  /**
   * Set a setting value.
   * @param key - The key of the setting to set.
   * @param value - The value to set.
   */
  async function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    // Clone the incoming value to prevent external mutations
    const clonedValue = _.cloneDeep(value)
    const oldValue = get(key)
    if (clonedValue === oldValue) return

    onChange(settingsById.value[key], clonedValue, oldValue)
    settingValues.value[key] = clonedValue
    await api.storeSetting(key, clonedValue)
  }

  /**
   * Get a setting value.
   * @param key - The key of the setting to get.
   * @returns The value of the setting.
   */
  function get<K extends keyof Settings>(key: K): Settings[K] {
    // Clone the value when returning to prevent external mutations
    return _.cloneDeep(settingValues.value[key] ?? getDefaultValue(key))
  }

  /**
   * Get the default value of a setting.
   * @param key - The key of the setting to get.
   * @returns The default value of the setting.
   */
  function getDefaultValue<K extends keyof Settings>(key: K): Settings[K] {
    const param = settingsById.value[key]
    return typeof param?.defaultValue === 'function'
      ? param.defaultValue()
      : param?.defaultValue
  }

  /**
   * Register a setting.
   * @param setting - The setting to register.
   */
  function addSetting(setting: SettingParams) {
    if (!setting.id) {
      throw new Error('Settings must have an ID')
    }
    if (setting.id in settingsById.value) {
      throw new Error(`Setting ${setting.id} must have a unique ID.`)
    }

    settingsById.value[setting.id] = setting

    // Trigger onChange callback with current value
    onChange(setting, get(setting.id), undefined)
  }

  /*
   * Load setting values from server.
   * This needs to be called before any setting is registered.
   */
  async function loadSettingValues() {
    if (Object.keys(settingsById.value).length) {
      throw new Error(
        'Setting values must be loaded before any setting is registered.'
      )
    }
    settingValues.value = await api.getSettings()

    // Run migrations after loading values but before settings are registered
    await runSettingMigrations()
  }

  return {
    settingValues,
    settingsById,
    addSetting,
    loadSettingValues,
    set,
    get,
    exists,
    getDefaultValue
  }
})
