import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { globalTracker } from '@/scripts/changeTracker'
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import { showTemplateWorkflowsDialog } from '@/services/dialogService'
import { useQueueStore } from './queueStore'

export interface ComfyCommand {
  id: string
  function: () => void | Promise<void>

  label?: string | (() => string)
  icon?: string | (() => string)
  tooltip?: string | (() => string)
  shortcut?: string
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
      id: 'Comfy.ResetView',
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
    }
  ]

  commandDefinitions.forEach(registerCommand)
  const getCommandFunction = (command: string) => {
    return commands.value[command]?.function ?? (() => {})
  }

  const getCommand = (command: string) => {
    return commands.value[command]
  }

  return {
    getCommand,
    getCommandFunction,
    registerCommand
  }
})
