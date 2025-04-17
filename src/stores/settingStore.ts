import _ from 'lodash'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { Settings } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import type { SettingParams } from '@/types/settingTypes'
import type { TreeNode } from '@/types/treeExplorerTypes'

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

function tryMigrateDeprecatedValue(setting: SettingParams, value: any) {
  return setting?.migrateDeprecatedValue?.(value) ?? value
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
    const newValue = tryMigrateDeprecatedValue(
      settingsById.value[key],
      clonedValue
    )
    const oldValue = get(key)
    if (newValue === oldValue) return

    onChange(settingsById.value[key], newValue, oldValue)
    settingValues.value[key] = newValue
    await api.storeSetting(key, newValue)
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

    if (settingValues.value[setting.id] !== undefined) {
      settingValues.value[setting.id] = tryMigrateDeprecatedValue(
        setting,
        settingValues.value[setting.id]
      )
    }
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
