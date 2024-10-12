// @ts-strict-ignore
/**
 * TODO: Migrate scripts/ui/settings.ts here
 *
 * Currently the reactive settings act as a proxy of the legacy settings.
 * Every time a setting is changed, the settingStore dispatch the change to the
 * legacy settings. Every time the legacy settings are changed, the legacy
 * settings directly updates the settingStore.settingValues.
 */

import { app } from '@/scripts/app'
import { ComfySettingsDialog } from '@/scripts/ui/settings'
import type { Settings } from '@/types/apiTypes'
import type { SettingParams } from '@/types/settingTypes'
import { buildTree } from '@/utils/treeUtil'
import { defineStore } from 'pinia'
import type { TreeNode } from 'primevue/treenode'
import { CORE_SETTINGS } from '@/stores/coreSettings'

export interface SettingTreeNode extends TreeNode {
  data?: SettingParams
}

interface State {
  settingValues: Record<string, any>
  settings: Record<string, SettingParams>
}

export const useSettingStore = defineStore('setting', {
  state: (): State => ({
    settingValues: {},
    settings: {}
  }),
  getters: {
    // Setting tree structure used for the settings dialog display.
    settingTree(): SettingTreeNode {
      const root = buildTree(
        Object.values(this.settings).filter(
          (setting: SettingParams) => setting.type !== 'hidden'
        ),
        (setting: SettingParams) => setting.category || setting.id.split('.')
      )

      const floatingSettings = root.children.filter((node) => node.leaf)
      if (floatingSettings.length) {
        root.children = root.children.filter((node) => !node.leaf)
        root.children.push({
          key: 'Other',
          label: 'Other',
          leaf: false,
          children: floatingSettings
        })
      }

      return root
    }
  },
  actions: {
    addSettings(settings: ComfySettingsDialog) {
      for (const id in settings.settingsLookup) {
        const value = settings.getSettingValue(id)
        this.settingValues[id] = value
      }
      this.settings = settings.settingsParamLookup

      CORE_SETTINGS.forEach((setting: SettingParams) => {
        settings.addSetting(setting)
      })
    },

    async set<K extends keyof Settings>(key: K, value: Settings[K]) {
      this.settingValues[key] = value
      await app.ui.settings.setSettingValueAsync(key, value)
    },

    get<K extends keyof Settings>(key: K): Settings[K] {
      return (
        this.settingValues[key] ?? app.ui.settings.getSettingDefaultValue(key)
      )
    }
  }
})
