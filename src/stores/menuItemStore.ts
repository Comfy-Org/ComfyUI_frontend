import { defineStore } from 'pinia'
import type { MenuItem } from 'primevue/menuitem'
import { ref } from 'vue'
import { useCommandStore } from './commandStore'

export const useMenuItemStore = defineStore('menuItem', () => {
  const commandStore = useCommandStore()
  const menuItems = ref<MenuItem[]>([])

  const registerMenuGroup = (path: string[], items: MenuItem[]) => {
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

  const registerCommands = (path: string[], commandIds: string[]) => {
    const items = commandIds
      .map((commandId) => commandStore.getCommand(commandId))
      .map(
        (command) =>
          ({
            command: command.function,
            label: command.menubarLabel,
            icon: command.icon,
            tooltip: command.tooltip,
            comfyCommand: command
          }) as MenuItem
      )
    registerMenuGroup(path, items)
  }

  registerCommands(['Workflow'], ['Comfy.NewBlankWorkflow'])

  registerCommands(
    ['Workflow'],
    ['Comfy.OpenWorkflow', 'Comfy.BrowseTemplates']
  )
  registerCommands(
    ['Workflow'],
    [
      'Comfy.SaveWorkflow',
      'Comfy.SaveWorkflowAs',
      'Comfy.ExportWorkflow',
      'Comfy.ExportWorkflowAPI'
    ]
  )

  registerCommands(['Edit'], ['Comfy.Undo', 'Comfy.Redo'])
  registerCommands(['Edit'], ['Comfy.ClearWorkflow'])
  registerCommands(['Edit'], ['Comfy.OpenClipspace'])

  return {
    menuItems,
    registerMenuGroup,
    registerCommands
  }
})
