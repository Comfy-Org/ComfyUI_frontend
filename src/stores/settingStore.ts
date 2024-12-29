import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Settings } from '@/types/apiTypes'
import type { SettingParams } from '@/types/settingTypes'
import type { TreeNode } from 'primevue/treenode'
import { buildTree } from '@/utils/treeUtil'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

export const getSettingInfo = (setting: SettingParams) => {
  const parts = setting.category || setting.id.split('.')
  return {
    category: parts[0],
    subCategory: parts[1],
    name: parts.slice(2).join('.')
  }
}

export interface SettingTreeNode extends TreeNode {
  data?: SettingParams
}

function tryMigrateDeprecatedValue(setting: SettingParams, value: any) {
  return setting?.migrateDeprecatedValue?.(value) ?? value
}

function onChange(setting: SettingParams, value: any, oldValue: any) {
  if (setting?.onChange && value !== oldValue) {
    setting.onChange(value)
    // Backward compatibility with old settings dialog.
    // Some extensions still listens event emitted by the old settings dialog.
    app.ui.settings.dispatchChange(setting.id, value, oldValue)
  }
}

export const useSettingStore = defineStore('setting', () => {
  const settingValues = ref<Record<string, any>>({})
  const settingsById = ref<Record<string, SettingParams>>({})

  const settingTree = computed<SettingTreeNode>(() => {
    const root = buildTree(
      Object.values(settingsById.value).filter(
        (setting: SettingParams) => setting.type !== 'hidden'
      ),
      (setting: SettingParams) => setting.category || setting.id.split('.')
    )

    const floatingSettings = (root.children ?? []).filter((node) => node.leaf)
    if (floatingSettings.length) {
      root.children = (root.children ?? []).filter((node) => !node.leaf)
      root.children.push({
        key: 'Other',
        label: 'Other',
        leaf: false,
        children: floatingSettings
      })
    }

    return root
  })

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
    const newValue = tryMigrateDeprecatedValue(settingsById.value[key], value)
    const oldValue = settingValues.value[key]
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
    return settingValues.value[key] ?? getDefaultValue(key)
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
    settingTree,
    addSetting,
    loadSettingValues,
    set,
    get,
    exists,
    getDefaultValue
  }
})
