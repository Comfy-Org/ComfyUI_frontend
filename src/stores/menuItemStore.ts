import { defineStore } from 'pinia'
import type { MenuItem } from 'primevue/menuitem'
import { ref } from 'vue'
import { type ComfyCommand, useCommandStore } from './commandStore'

export interface ComfyMenuItem extends MenuItem {
  id?: string
}

export const useMenuItemStore = defineStore('menuItem', () => {
  const commandStore = useCommandStore()
  const menuItems = ref<ComfyMenuItem[]>([])

  const registerMenuGroup = (path: string[], items: ComfyMenuItem[]) => {
    let currentLevel = menuItems.value

    // Traverse the path, creating nodes if necessary
    for (let i = 0; i < path.length; i++) {
      const segment = path[i]
      let found = currentLevel.find((item) => item.label === segment)

      if (!found) {
        // Create a new node if it doesn't exist
        found = {
          label: segment,
          items: []
        }
        currentLevel.push(found)
      }

      // Ensure the found item has an 'items' array
      if (!found.items) {
        found.items = []
      }

      // Move to the next level
      currentLevel = found.items
    }

    if (currentLevel.length > 0) {
      currentLevel.push({
        separator: true
      })
    }
    // Add the new items to the last level
    currentLevel.push(...items)
  }

  const registerCommands = (path: string[], commands: ComfyCommand[]) => {
    // Register commands that are not already registered
    for (const command of commands) {
      if (commandStore.isRegistered(command.id)) {
        continue
      }
      commandStore.registerCommand(command)
    }

    const items = commands.map(
      (command) =>
        ({
          ...command,
          command: command.function
        }) as ComfyMenuItem
    )
    registerMenuGroup(path, items)
  }

  const workflowMenuGroup: ComfyMenuItem[] = [
    {
      label: 'New',
      icon: 'pi pi-plus',
      command: () => commandStore.execute('Comfy.NewBlankWorkflow'),
      id: 'Comfy.NewBlankWorkflow'
    },
    {
      separator: true
    },
    {
      label: 'Open',
      icon: 'pi pi-folder-open',
      command: () => commandStore.execute('Comfy.OpenWorkflow'),
      id: 'Comfy.OpenWorkflow'
    },
    {
      label: 'Browse Templates',
      icon: 'pi pi-th-large',
      command: () => commandStore.execute('Comfy.BrowseTemplates'),
      id: 'Comfy.BrowseTemplates'
    },
    {
      separator: true
    },
    {
      label: 'Save',
      icon: 'pi pi-save',
      command: () => commandStore.execute('Comfy.SaveWorkflow'),
      id: 'Comfy.SaveWorkflow'
    },
    {
      label: 'Save As',
      icon: 'pi pi-save',
      command: () => commandStore.execute('Comfy.SaveWorkflowAs'),
      id: 'Comfy.SaveWorkflowAs'
    },
    {
      label: 'Export',
      icon: 'pi pi-download',
      command: () => commandStore.execute('Comfy.ExportWorkflow'),
      id: 'Comfy.ExportWorkflow'
    },
    {
      label: 'Export (API Format)',
      icon: 'pi pi-download',
      command: () => commandStore.execute('Comfy.ExportWorkflowAPI'),
      id: 'Comfy.ExportWorkflowAPI'
    }
  ]

  registerMenuGroup(['Workflow'], workflowMenuGroup)
  registerCommands(
    ['Edit'],
    [
      commandStore.getCommand('Comfy.Undo'),
      commandStore.getCommand('Comfy.Redo')
    ]
  )
  registerCommands(['Edit'], [commandStore.getCommand('Comfy.ClearWorkflow')])
  registerCommands(['Edit'], [commandStore.getCommand('Comfy.OpenClipspace')])

  return {
    menuItems,
    registerMenuGroup,
    registerCommands
  }
})
