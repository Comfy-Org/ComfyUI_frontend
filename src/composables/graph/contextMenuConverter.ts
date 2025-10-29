import type { IContextMenuValue } from '@/lib/litegraph/src/litegraph'

import type { MenuOption, SubMenuOption } from './useMoreOptionsMenu'

/**
 * Convert LiteGraph IContextMenuValue items to Vue MenuOption format
 * Used to bridge LiteGraph context menus into Vue node menus
 */
export function convertContextMenuToOptions(
  items: (IContextMenuValue | null)[]
): MenuOption[] {
  const result: MenuOption[] = []

  for (const item of items) {
    // Null items are separators in LiteGraph
    if (item === null) {
      result.push({ type: 'divider' })
      continue
    }

    // Skip items without content (shouldn't happen, but be safe)
    if (!item.content) {
      continue
    }

    const option: MenuOption = {
      label: item.content
    }

    // Handle disabled state by wrapping callback or not providing action
    if (item.disabled) {
      // For disabled items, we still provide an action that does nothing
      // so the UI can show it as disabled
      option.action = () => {
        // Do nothing - item is disabled
      }
    } else if (item.callback) {
      // Wrap the callback to match the () => void signature
      option.action = () => {
        try {
          item.callback?.call(item as any, item.value, {}, null as any, null as any, item as any)
        } catch (error) {
          console.error('Error executing context menu callback:', error)
        }
      }
    }

    // Handle submenus
    if (item.has_submenu && item.submenu?.options) {
      option.hasSubmenu = true
      option.submenu = convertSubmenuToOptions(item.submenu.options)
    }

    result.push(option)
  }

  return result
}

/**
 * Convert LiteGraph submenu items to Vue SubMenuOption format
 */
function convertSubmenuToOptions(
  items: readonly (IContextMenuValue | string | null)[]
): SubMenuOption[] {
  const result: SubMenuOption[] = []

  for (const item of items) {
    // Skip null separators and string items
    if (!item || typeof item === 'string') continue

    if (!item.content) continue

    const subOption: SubMenuOption = {
      label: item.content,
      action: () => {
        try {
          item.callback?.call(item as any, item.value, {}, null as any, null as any, item as any)
        } catch (error) {
          console.error('Error executing submenu callback:', error)
        }
      }
    }

    result.push(subOption)
  }

  return result
}

/**
 * Check if a menu option already exists in the list by label
 */
export function menuOptionExists(
  options: MenuOption[],
  label: string
): boolean {
  return options.some((opt) => opt.label === label)
}

/**
 * Filter out duplicate menu items based on label
 * Keeps the first occurrence of each label
 */
export function removeDuplicateMenuOptions(
  options: MenuOption[]
): MenuOption[] {
  const seen = new Set<string>()
  return options.filter((opt) => {
    // Always keep dividers
    if (opt.type === 'divider') return true

    // Skip items without labels
    if (!opt.label) return true

    // Filter duplicates
    if (seen.has(opt.label)) return false
    seen.add(opt.label)
    return true
  })
}
