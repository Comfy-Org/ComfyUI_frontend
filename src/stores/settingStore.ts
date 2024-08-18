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
import { Settings } from '@/types/apiTypes'
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

      app.ui.settings.addSetting({
        id: 'Comfy.Validation.Workflows',
        name: 'Validate workflows',
        type: 'boolean',
        defaultValue: true
      })

      app.ui.settings.addSetting({
        id: 'Comfy.NodeSearchBoxImpl',
        category: ['Comfy', 'Node Search Box', 'Implementation'],
        experimental: true,
        name: 'Node search box implementation',
        type: 'combo',
        options: ['default', 'litegraph (legacy)'],
        defaultValue: 'default'
      })

      app.ui.settings.addSetting({
        id: 'Comfy.NodeSearchBoxImpl.LinkReleaseTrigger',
        category: ['Comfy', 'Node Search Box', 'LinkReleaseTrigger'],
        name: 'Trigger on link release',
        tooltip: 'Only applies to the default implementation',
        type: 'combo',
        options: Object.values(LinkReleaseTriggerMode),
        defaultValue: LinkReleaseTriggerMode.ALWAYS
      })

      app.ui.settings.addSetting({
        id: 'Comfy.NodeSearchBoxImpl.NodePreview',
        category: ['Comfy', 'Node Search Box', 'NodePreview'],
        name: 'Node preview',
        tooltip: 'Only applies to the default implementation',
        type: 'boolean',
        defaultValue: true
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Sidebar.Location',
        category: ['Comfy', 'Sidebar', 'Location'],
        name: 'Sidebar location',
        type: 'combo',
        options: ['left', 'right'],
        defaultValue: 'left'
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Sidebar.Size',
        category: ['Comfy', 'Sidebar', 'Size'],
        name: 'Sidebar size',
        type: 'combo',
        options: ['normal', 'small'],
        defaultValue: window.innerWidth < 1600 ? 'small' : 'normal'
      })

      app.ui.settings.addSetting({
        id: 'Comfy.TextareaWidget.FontSize',
        category: ['Comfy', 'Node Widget', 'TextareaWidget', 'FontSize'],
        name: 'Textarea widget font size',
        type: 'slider',
        defaultValue: 10,
        attrs: {
          min: 8,
          max: 24
        }
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Workflow.SortNodeIdOnSave',
        name: 'Sort node IDs when saving workflow',
        type: 'boolean',
        defaultValue: false
      })
    },

    set<K extends keyof Settings>(key: K, value: Settings[K]) {
      this.settingValues[key] = value
      app.ui.settings.setSettingValue(key, value)
    },

    get<K extends keyof Settings>(key: K): Settings[K] {
      return (
        this.settingValues[key] ?? app.ui.settings.getSettingDefaultValue(key)
      )
    }
  }
})
