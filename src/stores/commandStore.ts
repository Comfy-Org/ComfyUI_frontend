import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { defineStore } from 'pinia'
import { ref } from 'vue'
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
import { useWorkspaceStore } from './workspaceStateStore'
import { LGraphGroup } from '@comfyorg/litegraph'
import { useTitleEditorStore } from './graphStore'

export interface ComfyCommand {
  id: string
  function: () => void | Promise<void>

  label?: string | (() => string)
  icon?: string | (() => string)
  tooltip?: string | (() => string)
  versionAdded?: string
}

const getTracker = () =>
  app.workflowManager.activeWorkflow?.changeTracker ?? globalTracker

export const useCommandStore = defineStore('command', () => {
  const settingStore = useSettingStore()

  const commands = ref<Record<string, ComfyCommand>>({})
  const registerCommand = (command: ComfyCommand) => {
    if (commands.value[command.id]) {
      console.warn(`Command ${command.id} already registered`)
    }
    commands.value[command.id] = command
  }

  const commandDefinitions: ComfyCommand[] = [
    {
      id: 'Comfy.NewBlankWorkflow',
      icon: 'pi pi-plus',
      label: 'New Blank Workflow',
      function: () => {
        app.workflowManager.setWorkflow(null)
        app.clean()
        app.graph.clear()
        app.workflowManager.activeWorkflow.track()
      }
    },
    {
      id: 'Comfy.OpenWorkflow',
      icon: 'pi pi-folder-open',
      label: 'Open Workflow',
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
      function: () => {
        app.workflowManager.activeWorkflow.save()
      }
    },
    {
      id: 'Comfy.SaveWorkflowAs',
      icon: 'pi pi-save',
      label: 'Save Workflow As',
      function: () => {
        app.workflowManager.activeWorkflow.save(true)
      }
    },
    {
      id: 'Comfy.ExportWorkflow',
      icon: 'pi pi-download',
      label: 'Export Workflow',
      function: () => {
        app.menu.exportWorkflow('workflow', 'workflow')
      }
    },
    {
      id: 'Comfy.ExportWorkflowAPI',
      icon: 'pi pi-download',
      label: 'Export Workflow (API Format)',
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
        app['openClipspace']?.()
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
        app.canvas.ds.changeScale(app.canvas.ds.scale + 0.1)
        app.canvas.setDirty(true, true)
      }
    },
    {
      id: 'Comfy.Canvas.ZoomOut',
      icon: 'pi pi-minus',
      label: 'Zoom Out',
      function: () => {
        app.canvas.ds.changeScale(app.canvas.ds.scale - 0.1)
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
      id: 'Comfy.ToggleQueueSidebarTab',
      icon: 'pi pi-history',
      label: 'Queue',
      versionAdded: '1.3.7',
      function: () => {
        const tabId = 'queue'
        const workspaceStore = useWorkspaceStore()
        workspaceStore.updateActiveSidebarTab(
          workspaceStore.activeSidebarTab === tabId ? null : tabId
        )
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
    }
  ]

  commandDefinitions.forEach(registerCommand)
  const getCommandFunction = (command: string) => {
    return commands.value[command]?.function ?? (() => {})
  }

  const getCommand = (command: string) => {
    return commands.value[command]
  }

  const isRegistered = (command: string) => {
    return !!commands.value[command]
  }

  const loadExtensionCommands = (extension: ComfyExtension) => {
    if (extension.commands) {
      for (const command of extension.commands) {
        registerCommand(command)
      }
    }
  }

  return {
    getCommand,
    getCommandFunction,
    registerCommand,
    isRegistered,
    loadExtensionCommands
  }
})
