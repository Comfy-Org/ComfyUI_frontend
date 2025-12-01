import type {
  IContextMenuValue,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

import type { MenuOption, SubMenuOption } from './useMoreOptionsMenu'

/**
 * Composable for collecting menu options from extensions
 */
export function useExtensionMenuOptions() {
  const convertSubmenuItems = (
    items: readonly (IContextMenuValue | string | null)[]
  ): SubMenuOption[] => {
    const result: SubMenuOption[] = []

    for (const item of items) {
      if (item === null) continue

      if (typeof item === 'string') {
        result.push({
          label: item,
          action: () => {}
        })
        continue
      }

      if (!item.content) continue

      if (item.disabled) continue

      const callback = item.callback
      result.push({
        label: item.content,
        action: callback
          ? () => {
              void callback.call(null as never)
            }
          : () => {}
      })
    }

    return result
  }

  const convertExtensionMenuItems = (
    items: (IContextMenuValue | null)[]
  ): MenuOption[] => {
    const result: MenuOption[] = []

    for (const item of items) {
      if (item === null) {
        result.push({ type: 'divider' })
        continue
      }

      if (!item.content) continue

      if (item.disabled) continue

      const menuOption: MenuOption = {
        label: item.content
      }

      if (item.callback) {
        const callback = item.callback
        menuOption.action = () => {
          void callback.call(null as never)
        }
      }

      if (item.has_submenu && item.submenu?.options) {
        menuOption.hasSubmenu = true
        menuOption.submenu = convertSubmenuItems(item.submenu.options)
      }

      result.push(menuOption)
    }

    return result
  }

  /**
   * Collects menu items from all registered extensions for the given node
   * @param node - The node to collect menu items for
   * @returns Array of MenuOption items from extensions
   */
  const getExtensionMenuOptions = (node: LGraphNode): MenuOption[] => {
    const extensionItems = app.collectNodeMenuItems(node)
    return convertExtensionMenuItems(extensionItems)
  }

  return {
    getExtensionMenuOptions
  }
}
