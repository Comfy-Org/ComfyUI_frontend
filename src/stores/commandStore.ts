import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { globalTracker } from '@/scripts/changeTracker'
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import { showTemplateWorkflowsDialog } from '@/services/dialogService'

type Command = () => void | Promise<void>

const getTracker = () =>
  app.workflowManager.activeWorkflow?.changeTracker ?? globalTracker

export const useCommandStore = defineStore('command', () => {
  const settingStore = useSettingStore()
  const commands = ref<Record<string, Command>>({
    'Comfy.NewBlankWorkflow': () => {
      app.workflowManager.setWorkflow(null)
      app.clean()
      app.graph.clear()
      app.workflowManager.activeWorkflow.track()
    },
    'Comfy.OpenWorkflow': () => {
      app.ui.loadFile()
    },
    'Comfy.LoadDefaultWorkflow': async () => {
      await app.loadGraphData()
    },
    'Comfy.SaveWorkflow': () => {
      app.workflowManager.activeWorkflow.save()
    },
    'Comfy.SaveWorkflowAs': () => {
      app.workflowManager.activeWorkflow.save(true)
    },
    'Comfy.ExportWorkflow': () => {
      app.menu.exportWorkflow('workflow', 'workflow')
    },
    'Comfy.ExportWorkflowAPI': () => {
      app.menu.exportWorkflow('workflow_api', 'output')
    },
    'Comfy.Undo': async () => {
      await getTracker().undo()
    },
    'Comfy.Redo': async () => {
      await getTracker().redo()
    },
    'Comfy.ClearWorkflow': () => {
      if (
        !settingStore.get('Comfy.ComfirmClear') ||
        confirm('Clear workflow?')
      ) {
        app.clean()
        app.graph.clear()
        api.dispatchEvent(new CustomEvent('graphCleared'))
      }
    },
    'Comfy.ResetView': () => {
      app.resetView()
    },
    'Comfy.OpenClipspace': () => {
      app['openClipspace']?.()
    },
    'Comfy.RefreshNodeDefinitions': async () => {
      await app.refreshComboInNodes()
    },
    'Comfy.Interrupt': async () => {
      await api.interrupt()
      useToastStore().add({
        severity: 'info',
        summary: 'Interrupted',
        detail: 'Execution has been interrupted',
        life: 1000
      })
    },
    'Comfy.BrowseTemplates': showTemplateWorkflowsDialog
  })

  const getCommand = (command: string) => {
    return commands.value[command] ?? (() => {})
  }

  return {
    commands,
    getCommand
  }
})
