import { whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { MenuItem, MenuItemAction } from '@/components/ui/menu/types'
import { CORE_MENU_COMMANDS } from '@/constants/coreMenuCommands'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { ComfyExtension } from '@/types/comfy'

import { useCommandStore } from './commandStore'

export interface CommandMenuItem extends MenuItemAction {
  commandId: string
}

export type AppMenuItem = MenuItem | CommandMenuItem

export const useMenuItemStore = defineStore('menuItem', () => {
  const canvasStore = useCanvasStore()
  const commandStore = useCommandStore()
  const menuItems = ref<AppMenuItem[]>([])
  const hasSeenLinear = ref(false)

  whenever(
    () => canvasStore.linearMode,
    () => (hasSeenLinear.value = true),
    { immediate: true, once: true }
  )

  const registerMenuGroup = (path: string[], items: AppMenuItem[]) => {
    let currentLevel = menuItems.value

    // Traverse the path, creating nodes if necessary
    for (let i = 0; i < path.length; i++) {
      const segment = path[i]
      const foundIndex = currentLevel.findIndex(
        (item) => item.label === segment
      )
      let found = currentLevel[foundIndex]

      if (foundIndex === -1) {
        // Create a new node if it doesn't exist
        found = {
          label: segment,
          key: segment,
          items: []
        }
        currentLevel.push(found)
      }

      if (!found.items) {
        const { checked, command, radioGroup, separator, ...metadata } = found
        found = { ...metadata, items: [] }
        currentLevel[foundIndex] = found
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
  function commandIdToMenuItem(commandId: string): CommandMenuItem {
    const command = commandStore.getCommand(commandId)
    return {
      command: () => commandStore.execute(command.id),
      label: command.menubarLabel,
      icon: command.id === 'Comfy.NewBlankWorkflow' ? undefined : command.icon,
      tooltip: command.tooltip,
      commandId: command.id,
      checked: command.active,
      shortcut: () => command.keybinding?.combo.toString(),
      pressAndHoldInterval:
        command.id === 'Comfy.Canvas.ZoomIn' ||
        command.id === 'Comfy.Canvas.ZoomOut'
          ? 50
          : undefined,
      trailingIcon:
        command.id === 'Comfy.NewBlankWorkflow' ? command.icon : undefined
    }
  }

  const registerCommands = (path: string[], commandIds: string[]) => {
    const items = commandIds.map(commandIdToMenuItem)
    registerMenuGroup(path, items)
  }

  const loadExtensionMenuCommands = (extension: ComfyExtension) => {
    if (!extension.menuCommands) {
      return
    }

    const extensionCommandIds = new Set(
      extension.commands?.map((command) => command.id) ?? []
    )
    extension.menuCommands.forEach((menuCommand) => {
      const commands = menuCommand.commands.filter((command) =>
        extensionCommandIds.has(command)
      )
      if (commands.length) {
        registerCommands(menuCommand.path, commands)
      }
    })
  }

  const registerCoreMenuCommands = () => {
    for (const [path, commands] of CORE_MENU_COMMANDS) {
      registerCommands(path, commands)
    }
  }

  return {
    menuItems,
    registerMenuGroup,
    registerCommands,
    loadExtensionMenuCommands,
    registerCoreMenuCommands,
    hasSeenLinear,
    commandIdToMenuItem
  }
})
