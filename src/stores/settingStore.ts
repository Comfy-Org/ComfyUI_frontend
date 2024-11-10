/**
 * TODO: Migrate scripts/ui/settings.ts here
 *
 * Currently the reactive settings act as a proxy of the legacy settings.
 * Every time a setting is changed, the settingStore dispatch the change to the
 * legacy settings. Every time the legacy settings are changed, the legacy
 * settings directly updates the settingStore.settingValues.
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { app } from '@/scripts/app'
import { ComfySettingsDialog } from '@/scripts/ui/settings'
import type { Settings } from '@/types/apiTypes'
import type { SettingParams } from '@/types/settingTypes'
import type { TreeNode } from 'primevue/treenode'
import type { ComfyExtension } from '@/types/comfy'
import { buildTree } from '@/utils/treeUtil'
import { CORE_SETTINGS } from '@/stores/coreSettings'

export interface SettingTreeNode extends TreeNode {
  data?: SettingParams
}

export const useSettingStore = defineStore('setting', () => {
  const settingValues = ref<Record<string, any>>({})
  const settings = ref<Record<string, SettingParams>>({})

  const settingTree = computed<SettingTreeNode>(() => {
    const root = buildTree(
      Object.values(settings.value).filter(
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

  function addSettings(settingsDialog: ComfySettingsDialog) {
    for (const id in settingsDialog.settingsLookup) {
      const value = settingsDialog.getSettingValue(id)
      settingValues.value[id] = value
    }
    settings.value = settingsDialog.settingsParamLookup

    CORE_SETTINGS.forEach((setting: SettingParams) => {
      settingsDialog.addSetting(setting)
    })
  }

  function loadExtensionSettings(extension: ComfyExtension) {
    extension.settings?.forEach((setting: SettingParams) => {
      app.ui.settings.addSetting(setting)
    })
  }

  async function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    settingValues.value[key] = value
    await app.ui.settings.setSettingValueAsync(key, value)
  }

  function get<K extends keyof Settings>(key: K): Settings[K] {
    return (
      settingValues.value[key] ?? app.ui.settings.getSettingDefaultValue(key)
    )
  }

  return {
    settingValues,
    settings,
    settingTree,
    addSettings,
    loadExtensionSettings,
    set,
    get
  }
})
