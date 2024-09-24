import { defineStore } from 'pinia'
import type { MenuItem } from 'primevue/menuitem'
import { computed } from 'vue'
import { useCommandStore } from './commandStore'

export const useCoreMenuItemStore = defineStore('coreMenuItem', () => {
  const commandStore = useCommandStore()
  const menuItems = computed<MenuItem[]>(() => {
    return [
      {
        label: 'Workflow',
        items: [
          {
            label: 'New',
            icon: 'pi pi-plus',
            command: commandStore.commands['Comfy.NewBlankWorkflow']
          },
          {
            separator: true
          },
          {
            label: 'Open',
            icon: 'pi pi-folder-open',
            command: commandStore.commands['Comfy.OpenWorkflow']
          },
          {
            label: 'Browse Templates',
            icon: 'pi pi-th-large',
            command: commandStore.commands['Comfy.BrowseTemplates']
          },
          {
            separator: true
          },
          {
            label: 'Save',
            icon: 'pi pi-save',
            command: commandStore.commands['Comfy.SaveWorkflow']
          },
          {
            label: 'Save As',
            icon: 'pi pi-save',
            command: commandStore.commands['Comfy.SaveWorkflowAs']
          },
          {
            label: 'Export',
            icon: 'pi pi-download',
            command: commandStore.commands['Comfy.ExportWorkflow']
          },
          {
            label: 'Export (API Format)',
            icon: 'pi pi-download',
            command: commandStore.commands['Comfy.ExportWorkflowAPI']
          }
        ]
      },
      {
        label: 'Edit',
        items: [
          {
            label: 'Undo',
            icon: 'pi pi-undo',
            command: commandStore.commands['Comfy.Undo']
          },
          {
            label: 'Redo',
            icon: 'pi pi-refresh',
            command: commandStore.commands['Comfy.Redo']
          },
          {
            separator: true
          },
          {
            label: 'Clear Workflow',
            icon: 'pi pi-trash',
            command: commandStore.commands['Comfy.ClearWorkflow']
          },
          {
            separator: true
          },
          {
            label: 'Clipspace',
            icon: 'pi pi-clipboard',
            command: commandStore.commands['Comfy.OpenClipspace']
          }
        ]
      }
    ]
  })

  return {
    menuItems
  }
})
