import { defineStore } from 'pinia'
import type { MenuItem } from 'primevue/menuitem'
import { computed } from 'vue'
import { app } from '@/scripts/app'
import { globalTracker } from '@/scripts/changeTracker'

const getTracker = () =>
  app.workflowManager.activeWorkflow?.changeTracker ?? globalTracker

export const useCoreMenuItemStore = defineStore('coreMenuItem', () => {
  const menuItems = computed<MenuItem[]>(() => {
    return [
      {
        label: 'Workflow',
        items: [
          {
            label: 'New',
            icon: 'pi pi-plus',
            command: () => {
              app.workflowManager.setWorkflow(null)
              app.clean()
              app.graph.clear()
              app.workflowManager.activeWorkflow.track()
            }
          },
          {
            separator: true
          },
          {
            label: 'Open',
            icon: 'pi pi-folder-open',
            command: () => {
              app.ui.loadFile()
            }
          },
          {
            separator: true
          },
          {
            label: 'Save',
            icon: 'pi pi-save',
            command: () => {
              app.workflowManager.activeWorkflow.save()
            }
          },
          {
            label: 'Save As',
            icon: 'pi pi-save',
            command: () => {
              app.workflowManager.activeWorkflow.save(true)
            }
          },
          {
            label: 'Export',
            icon: 'pi pi-download',
            command: () => {
              app.menu.exportWorkflow('workflow', 'workflow')
            }
          },
          {
            label: 'Export (API Format)',
            icon: 'pi pi-download',
            command: () => {
              app.menu.exportWorkflow('workflow_api', 'output')
            }
          }
        ]
      },
      {
        label: 'Edit',
        items: [
          {
            label: 'Undo',
            icon: 'pi pi-undo',
            command: async () => {
              await getTracker().undo()
            }
          },
          {
            label: 'Redo',
            icon: 'pi pi-refresh',
            command: async () => {
              await getTracker().redo()
            }
          }
        ]
      }
    ]
  })

  return {
    menuItems
  }
})
