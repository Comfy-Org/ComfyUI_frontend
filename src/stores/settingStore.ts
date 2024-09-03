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
import {
  LinkReleaseTriggerAction,
  LinkReleaseTriggerMode
} from '@/types/searchBoxTypes'
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
        type: 'hidden',
        options: Object.values(LinkReleaseTriggerMode),
        defaultValue: LinkReleaseTriggerMode.ALWAYS,
        deprecated: true
      })

      app.ui.settings.addSetting({
        id: 'Comfy.LinkRelease.Action',
        name: 'Action on link release (No modifier)',
        type: 'combo',
        options: Object.values(LinkReleaseTriggerAction),
        defaultValue: LinkReleaseTriggerAction.CONTEXT_MENU
      })

      app.ui.settings.addSetting({
        id: 'Comfy.LinkRelease.ActionShift',
        name: 'Action on link release (Shift)',
        type: 'combo',
        options: Object.values(LinkReleaseTriggerAction),
        defaultValue: LinkReleaseTriggerAction.SEARCH_BOX
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
        id: 'Comfy.NodeSearchBoxImpl.ShowCategory',
        category: ['Comfy', 'Node Search Box', 'ShowCategory'],
        name: 'Show node category in search results',
        tooltip: 'Only applies to the default implementation',
        type: 'boolean',
        defaultValue: true
      })

      app.ui.settings.addSetting({
        id: 'Comfy.NodeSearchBoxImpl.ShowIdName',
        category: ['Comfy', 'Node Search Box', 'ShowIdName'],
        name: 'Show node id name in search results',
        tooltip: 'Only applies to the default implementation',
        type: 'boolean',
        defaultValue: false
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
        id: 'Comfy.TextareaWidget.Spellcheck',
        category: ['Comfy', 'Node Widget', 'TextareaWidget', 'Spellcheck'],
        name: 'Textarea widget spellcheck',
        type: 'boolean',
        defaultValue: false
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Workflow.SortNodeIdOnSave',
        name: 'Sort node IDs when saving workflow',
        type: 'boolean',
        defaultValue: false
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Graph.CanvasInfo',
        name: 'Show canvas info (fps, etc.)',
        type: 'boolean',
        defaultValue: true
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Node.ShowDeprecated',
        name: 'Show deprecated nodes in search',
        tooltip:
          'Deprecated nodes are hidden by default in the UI, but remain functional in existing workflows that use them.',
        type: 'boolean',
        defaultValue: false
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Node.ShowExperimental',
        name: 'Show experimental nodes in search',
        tooltip:
          'Experimental nodes are marked as such in the UI and may be subject to significant changes or removal in future versions. Use with caution in production workflows',
        type: 'boolean',
        defaultValue: true
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Workflow.ShowMissingNodesWarning',
        name: 'Show missing nodes warning',
        type: 'boolean',
        defaultValue: true
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Workflow.ShowMissingModelsWarning',
        name: 'Show missing models warning',
        type: 'boolean',
        defaultValue: false,
        experimental: true
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Graph.ZoomSpeed',
        name: 'Canvas zoom speed',
        type: 'slider',
        defaultValue: 1.1,
        attrs: {
          min: 1.01,
          max: 2.5,
          step: 0.01
        }
      })

      // Bookmarks are stored in the settings store.
      // Bookmarks are in format of category/display_name. e.g. "conditioning/CLIPTextEncode"
      app.ui.settings.addSetting({
        id: 'Comfy.NodeLibrary.Bookmarks',
        name: 'Node library bookmarks with display name (deprecated)',
        type: 'hidden',
        defaultValue: [],
        deprecated: true
      })

      app.ui.settings.addSetting({
        id: 'Comfy.NodeLibrary.Bookmarks.V2',
        name: 'Node library bookmarks v2 with unique name',
        type: 'hidden',
        defaultValue: []
      })

      // Stores mapping from bookmark folder name to its customization.
      app.ui.settings.addSetting({
        id: 'Comfy.NodeLibrary.BookmarksCustomization',
        name: 'Node library bookmarks customization',
        type: 'hidden',
        defaultValue: {}
      })

      // Hidden setting used by the queue for how to fit images
      app.ui.settings.addSetting({
        id: 'Comfy.Queue.ImageFit',
        name: 'Queue image fit',
        type: 'hidden',
        defaultValue: 'cover'
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Workflow.ModelDownload.AllowedSources',
        name: 'Allowed model download sources',
        type: 'hidden',
        defaultValue: ['https://huggingface.co/', 'https://civitai.com/']
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Workflow.ModelDownload.AllowedSuffixes',
        name: 'Allowed model download suffixes',
        type: 'hidden',
        defaultValue: ['.safetensors', '.sft']
      })

      app.ui.settings.addSetting({
        id: 'Comfy.GroupSelectedNodes.Padding',
        name: 'Group selected nodes padding',
        type: 'slider',
        defaultValue: 10,
        attrs: {
          min: 0,
          max: 100
        }
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Node.DoubleClickTitleToEdit',
        name: 'Double click node title to edit',
        type: 'boolean',
        defaultValue: true
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Group.DoubleClickTitleToEdit',
        name: 'Double click group title to edit',
        type: 'boolean',
        defaultValue: true
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Window.UnloadConfirmation',
        name: 'Show confirmation when closing window',
        type: 'boolean',
        defaultValue: false
      })

      app.ui.settings.addSetting({
        id: 'Comfy.TreeExplorer.ItemPadding',
        name: 'Tree explorer item padding',
        type: 'slider',
        defaultValue: 2,
        attrs: {
          min: 0,
          max: 8,
          step: 1
        }
      })

      app.ui.settings.addSetting({
        id: 'Comfy.Locale',
        name: 'Locale',
        type: 'combo',
        options: ['en', 'zh'],
        defaultValue: navigator.language.split('-')[0] || 'en'
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
