import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Settings } from '@/types/apiTypes'
import type { SettingParams } from '@/types/settingTypes'
import type { TreeNode } from 'primevue/treenode'
import { buildTree } from '@/utils/treeUtil'
import { api } from '@/scripts/api'

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

  function exists(key: string) {
    return settingValues.value[key] !== undefined
  }

  async function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    const newValue = tryMigrateDeprecatedValue(settingsById.value[key], value)
    settingValues.value[key] = newValue
    await api.storeSetting(key, newValue)
  }

  function get<K extends keyof Settings>(key: K): Settings[K] {
    return settingValues.value[key] ?? getDefaultValue(key)
  }

  function getDefaultValue<K extends keyof Settings>(key: K): Settings[K] {
    const param = settingsById.value[key]
    return typeof param?.defaultValue === 'function'
      ? param.defaultValue()
      : param?.defaultValue
  }

  function addSetting(setting: SettingParams) {
    if (!setting.id) {
      throw new Error('Settings must have an ID')
    }
    if (setting.id in settingsById.value) {
      throw new Error(`Setting ${setting.id} must have a unique ID.`)
    }

    settingsById.value[setting.id] = setting
  }

  async function loadSettingValues() {
    const values = await api.getSettings()
    for (const [key, value] of Object.entries(values)) {
      settingValues.value[key] = tryMigrateDeprecatedValue(
        settingsById.value[key],
        value
      )
    }
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
