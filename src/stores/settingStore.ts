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
import { LinkReleaseTriggerMode } from '@/types/searchBoxTypes'
import { SettingParams } from '@/types/settingTypes'
import { buildTree } from '@/utils/treeUtil'
import { defineStore } from 'pinia'
import type { TreeNode } from 'primevue/treenode'

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
    settingTree(): SettingTreeNode {
      const root = buildTree(
        Object.values(this.settings),
        (setting: SettingParams) => setting.id.split('.')
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

      app.ui.settings.addSetting({
        id: 'Comfy.Validation.Workflows',
        name: 'Validate workflows',
        type: 'boolean',
        defaultValue: true
      })

      app.ui.settings.addSetting({
        id: 'Comfy.NodeSearchBoxImpl',
        name: 'Node Search box implementation',
        type: 'combo',
        options: ['default', 'litegraph (legacy)'],
        defaultValue: 'default'
      })

      app.ui.settings.addSetting({
        id: 'Comfy.NodeSearchBoxImpl.LinkReleaseTrigger',
        name: 'Trigger on link release',
        tooltip: 'Only applies to the default implementation',
        type: 'combo',
        options: Object.values(LinkReleaseTriggerMode),
        defaultValue: LinkReleaseTriggerMode.ALWAYS
      })
    },

    set(key: string, value: any) {
      this.settingValues[key] = value
      app.ui.settings.setSettingValue(key, value)
    },

    get<T = any>(key: string): T {
      return (
        this.settingValues[key] ?? app.ui.settings.getSettingDefaultValue(key)
      )
    }
  }
})
