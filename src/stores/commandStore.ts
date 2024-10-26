import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { globalTracker } from '@/scripts/changeTracker'
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import {
  showSettingsDialog,
  showTemplateWorkflowsDialog
} from '@/services/dialogService'
import { useQueueSettingsStore, useQueueStore } from './queueStore'
import { LiteGraph } from '@comfyorg/litegraph'
import { ComfyExtension } from '@/types/comfy'
import { LGraphGroup } from '@comfyorg/litegraph'
import { useTitleEditorStore } from './graphStore'
import { useErrorHandling } from '@/hooks/errorHooks'
import { useWorkflowStore } from './workflowStore'
import { type KeybindingImpl, useKeybindingStore } from './keybindingStore'
import { useBottomPanelStore } from './workspace/bottomPanelStore'
import { LGraphNode } from '@comfyorg/litegraph'

export interface ComfyCommand {
  id: string
  function: () => void | Promise<void>

  label?: string | (() => string)
  icon?: string | (() => string)
  tooltip?: string | (() => string)
  /** Menubar item label, if different from command label */
  menubarLabel?: string | (() => string)
  versionAdded?: string
}

export class ComfyCommandImpl implements ComfyCommand {
  id: string
  function: () => void | Promise<void>
  _label?: string | (() => string)
  _icon?: string | (() => string)
  _tooltip?: string | (() => string)
  _menubarLabel?: string | (() => string)
  versionAdded?: string

  constructor(command: ComfyCommand) {
    this.id = command.id
    this.function = command.function
    this._label = command.label
    this._icon = command.icon
    this._tooltip = command.tooltip
    this._menubarLabel = command.menubarLabel ?? command.label
    this.versionAdded = command.versionAdded
  }

  get label() {
    return typeof this._label === 'function' ? this._label() : this._label
  }

  get icon() {
    return typeof this._icon === 'function' ? this._icon() : this._icon
  }

  get tooltip() {
    return typeof this._tooltip === 'function' ? this._tooltip() : this._tooltip
  }

  get menubarLabel() {
    return typeof this._menubarLabel === 'function'
      ? this._menubarLabel()
      : this._menubarLabel
  }

  get keybinding(): KeybindingImpl | null {
    return useKeybindingStore().getKeybindingByCommandId(this.id)
  }
}

const getTracker = () =>
  app.workflowManager.activeWorkflow?.changeTracker ?? globalTracker

const getSelectedNodes = (): LGraphNode[] => {
  const selectedNodes = app.canvas.selected_nodes
  const result: LGraphNode[] = []
  if (selectedNodes) {
    for (const i in selectedNodes) {
      const node = selectedNodes[i]
      result.push(node)
    }
  }
  return result
}

const toggleSelectedNodesMode = (mode: number) => {
  getSelectedNodes().forEach((node) => {
    if (node.mode === mode) {
      node.mode = 0 // always
    } else {
      node.mode = mode
    }
  })
}

export const useCommandStore = defineStore('command', () => {
  const settingStore = useSettingStore()

  const commandsById = ref<Record<string, ComfyCommandImpl>>({})
  const commands = computed(() => Object.values(commandsById.value))

  const registerCommand = (command: ComfyCommand) => {
    if (commandsById.value[command.id]) {
      console.warn(`Command ${command.id} already registered`)
    }
    commandsById.value[command.id] = new ComfyCommandImpl(command)
  }

  const commandDefinitions: ComfyCommand[] = [
    {
      id: 'Comfy.NewBlankWorkflow',
      icon: 'pi pi-plus',
      label: 'New Blank Workflow',
      menubarLabel: 'New',
      function: () => {
        app.workflowManager.setWorkflow(null)
        app.clean()
        app.graph.clear()
        app.workflowManager.activeWorkflow?.track()
      }
    },
    {
      id: 'Comfy.OpenWorkflow',
      icon: 'pi pi-folder-open',
      label: 'Open Workflow',
      menubarLabel: 'Open',
      function: () => {
        app.ui.loadFile()
      }
    },
    {
      id: 'Comfy.LoadDefaultWorkflow',
      icon: 'pi pi-code',
      label: 'Load Default Workflow',
      function: async () => {
        await app.loadGraphData()
      }
    },
    {
      id: 'Comfy.SaveWorkflow',
      icon: 'pi pi-save',
      label: 'Save Workflow',
      menubarLabel: 'Save',
      function: () => {
        app.workflowManager.activeWorkflow?.save()
      }
    },
    {
      id: 'Comfy.SaveWorkflowAs',
      icon: 'pi pi-save',
      label: 'Save Workflow As',
      menubarLabel: 'Save As',
      function: () => {
        app.workflowManager.activeWorkflow?.save(true)
      }
    },
    {
      id: 'Comfy.ExportWorkflow',
      icon: 'pi pi-download',
      label: 'Export Workflow',
      menubarLabel: 'Export',
      function: () => {
        app.menu.exportWorkflow('workflow', 'workflow')
      }
    },
    {
      id: 'Comfy.ExportWorkflowAPI',
      icon: 'pi pi-download',
      label: 'Export Workflow (API Format)',
      menubarLabel: 'Export (API)',
      function: () => {
        app.menu.exportWorkflow('workflow_api', 'output')
      }
    },
    {
      id: 'Comfy.Undo',
      icon: 'pi pi-undo',
      label: 'Undo',
      function: async () => {
        await getTracker().undo()
      }
    },
    {
      id: 'Comfy.Redo',
      icon: 'pi pi-refresh',
      label: 'Redo',
      function: async () => {
        await getTracker().redo()
      }
    },
    {
      id: 'Comfy.ClearWorkflow',
      icon: 'pi pi-trash',
      label: 'Clear Workflow',
      function: () => {
        if (
          !settingStore.get('Comfy.ComfirmClear') ||
          confirm('Clear workflow?')
        ) {
          app.clean()
          app.graph.clear()
          api.dispatchEvent(new CustomEvent('graphCleared'))
        }
      }
    },
    {
      id: 'Comfy.Canvas.ResetView',
      icon: 'pi pi-expand',
      label: 'Reset View',
      function: () => {
        app.resetView()
      }
    },
    {
      id: 'Comfy.OpenClipspace',
      icon: 'pi pi-clipboard',
      label: 'Clipspace',
      function: () => {
        app.openClipspace()
      }
    },
    {
      id: 'Comfy.RefreshNodeDefinitions',
      icon: 'pi pi-refresh',
      label: 'Refresh Node Definitions',
      function: async () => {
        await app.refreshComboInNodes()
      }
    },
    {
      id: 'Comfy.Interrupt',
      icon: 'pi pi-stop',
      label: 'Interrupt',
      function: async () => {
        await api.interrupt()
        useToastStore().add({
          severity: 'info',
          summary: 'Interrupted',
          detail: 'Execution has been interrupted',
          life: 1000
        })
      }
    },
    {
      id: 'Comfy.ClearPendingTasks',
      icon: 'pi pi-stop',
      label: 'Clear Pending Tasks',
      function: async () => {
        await useQueueStore().clear(['queue'])
        useToastStore().add({
          severity: 'info',
          summary: 'Confirmed',
          detail: 'Pending tasks deleted',
          life: 3000
        })
      }
    },
    {
      id: 'Comfy.BrowseTemplates',
      icon: 'pi pi-folder-open',
      label: 'Browse Templates',
      function: showTemplateWorkflowsDialog
    },
    {
      id: 'Comfy.Canvas.ZoomIn',
      icon: 'pi pi-plus',
      label: 'Zoom In',
      function: () => {
        const ds = app.canvas.ds
        ds.changeScale(
          ds.scale * 1.1,
          ds.element ? [ds.element.width / 2, ds.element.height / 2] : undefined
        )
        app.canvas.setDirty(true, true)
      }
    },
    {
      id: 'Comfy.Canvas.ZoomOut',
      icon: 'pi pi-minus',
      label: 'Zoom Out',
      function: () => {
        const ds = app.canvas.ds
        ds.changeScale(
          ds.scale / 1.1,
          ds.element ? [ds.element.width / 2, ds.element.height / 2] : undefined
        )
        app.canvas.setDirty(true, true)
      }
    },
    {
      id: 'Comfy.Canvas.ToggleLock',
      icon: 'pi pi-lock',
      label: 'Toggle Lock',
      function: () => {
        app.canvas['read_only'] = !app.canvas['read_only']
      }
    },
    {
      id: 'Comfy.Canvas.ToggleLinkVisibility',
      icon: 'pi pi-eye',
      label: 'Toggle Link Visibility',
      versionAdded: '1.3.6',

      function: (() => {
        let lastLinksRenderMode = LiteGraph.SPLINE_LINK

        return () => {
          const currentMode = settingStore.get('Comfy.LinkRenderMode')

          if (currentMode === LiteGraph.HIDDEN_LINK) {
            // If links are hidden, restore the last positive value or default to spline mode
            settingStore.set('Comfy.LinkRenderMode', lastLinksRenderMode)
          } else {
            // If links are visible, store the current mode and hide links
            lastLinksRenderMode = currentMode
            settingStore.set('Comfy.LinkRenderMode', LiteGraph.HIDDEN_LINK)
          }
        }
      })()
    },
    {
      id: 'Comfy.QueuePrompt',
      icon: 'pi pi-play',
      label: 'Queue Prompt',
      versionAdded: '1.3.7',
      function: () => {
        const batchCount = useQueueSettingsStore().batchCount
        app.queuePrompt(0, batchCount)
      }
    },
    {
      id: 'Comfy.QueuePromptFront',
      icon: 'pi pi-play',
      label: 'Queue Prompt (Front)',
      versionAdded: '1.3.7',
      function: () => {
        const batchCount = useQueueSettingsStore().batchCount
        app.queuePrompt(-1, batchCount)
      }
    },
    {
      id: 'Comfy.ShowSettingsDialog',
      icon: 'pi pi-cog',
      label: 'Settings',
      versionAdded: '1.3.7',
      function: () => {
        showSettingsDialog()
      }
    },
    {
      id: 'Comfy.Graph.GroupSelectedNodes',
      icon: 'pi pi-sitemap',
      label: 'Group Selected Nodes',
      versionAdded: '1.3.7',
      function: () => {
        if (
          !app.canvas.selected_nodes ||
          Object.keys(app.canvas.selected_nodes).length === 0
        ) {
          useToastStore().add({
            severity: 'error',
            summary: 'No nodes selected',
            detail: 'Please select nodes to group',
            life: 3000
          })
          return
        }
        const group = new LGraphGroup()
        const padding = useSettingStore().get(
          'Comfy.GroupSelectedNodes.Padding'
        )
        group.addNodes(Object.values(app.canvas.selected_nodes), padding)
        app.canvas.graph.add(group)
        useTitleEditorStore().titleEditorTarget = group
      }
    },
    {
      id: 'Workspace.NextOpenedWorkflow',
      icon: 'pi pi-step-forward',
      label: 'Next Opened Workflow',
      versionAdded: '1.3.9',
      function: () => {
        useWorkflowStore().loadNextOpenedWorkflow()
      }
    },
    {
      id: 'Workspace.PreviousOpenedWorkflow',
      icon: 'pi pi-step-backward',
      label: 'Previous Opened Workflow',
      versionAdded: '1.3.9',
      function: () => {
        useWorkflowStore().loadPreviousOpenedWorkflow()
      }
    },
    {
      id: 'Comfy.Canvas.ToggleSelectedNodes.Mute',
      icon: 'pi pi-volume-off',
      label: 'Mute/Unmute Selected Nodes',
      versionAdded: '1.3.11',
      function: () => {
        toggleSelectedNodesMode(2) // muted
      }
    },
    {
      id: 'Comfy.Canvas.ToggleSelectedNodes.Bypass',
      icon: 'pi pi-shield',
      label: 'Bypass/Unbypass Selected Nodes',
      versionAdded: '1.3.11',
      function: () => {
        toggleSelectedNodesMode(4) // bypassed
      }
    },
    {
      id: 'Comfy.Canvas.ToggleSelectedNodes.Pin',
      icon: 'pi pi-pin',
      label: 'Pin/Unpin Selected Nodes',
      versionAdded: '1.3.11',
      function: () => {
        getSelectedNodes().forEach((node) => {
          node.pin(!node.pinned)
        })
      }
    },
    {
      id: 'Comfy.Canvas.ToggleSelectedNodes.Collapse',
      icon: 'pi pi-minus',
      label: 'Collapse/Expand Selected Nodes',
      versionAdded: '1.3.11',
      function: () => {
        getSelectedNodes().forEach((node) => {
          node.collapse()
        })
      }
    },
    {
      id: 'Comfy.ToggleTheme',
      icon: 'pi pi-moon',
      label: 'Toggle Theme',
      versionAdded: '1.3.12',
      function: (() => {
        let previousDarkTheme: string = 'dark'

        // Official light theme is the only light theme supported now.
        const isDarkMode = (themeId: string) => themeId !== 'light'
        return () => {
          const currentTheme = settingStore.get('Comfy.ColorPalette')
          if (isDarkMode(currentTheme)) {
            previousDarkTheme = currentTheme
            settingStore.set('Comfy.ColorPalette', 'light')
          } else {
            settingStore.set('Comfy.ColorPalette', previousDarkTheme)
          }
        }
      })()
    },
    {
      id: 'Workspace.ToggleBottomPanel',
      icon: 'pi pi-list',
      label: 'Toggle Bottom Panel',
      versionAdded: '1.3.22',
      function: () => {
        useBottomPanelStore().toggleBottomPanel()
      }
    }
  ]

  commandDefinitions.forEach(registerCommand)
  const getCommand = (command: string) => {
    return commandsById.value[command]
  }

  const { wrapWithErrorHandlingAsync } = useErrorHandling()
  const execute = async (
    commandId: string,
    errorHandler?: (error: any) => void
  ) => {
    const command = getCommand(commandId)
    if (command) {
      await wrapWithErrorHandlingAsync(command.function, errorHandler)()
    } else {
      throw new Error(`Command ${commandId} not found`)
    }
  }

  const isRegistered = (command: string) => {
    return !!commandsById.value[command]
  }

  const loadExtensionCommands = (extension: ComfyExtension) => {
    if (extension.commands) {
      for (const command of extension.commands) {
        registerCommand(command)
      }
    }
  }

  return {
    commands,
    execute,
    getCommand,
    registerCommand,
    isRegistered,
    loadExtensionCommands
  }
})
