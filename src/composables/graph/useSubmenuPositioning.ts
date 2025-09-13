import { nextTick } from 'vue'

import type { MenuOption } from './useMoreOptionsMenu'

/**
 * Composable for handling submenu positioning logic
 */
export function useSubmenuPositioning() {
  /**
   * Toggle submenu visibility with proper positioning
   * @param option - Menu option with submenu
   * @param event - Click event
   * @param submenu - PrimeVue Popover reference
   * @param currentSubmenu - Currently open submenu name
   * @param menuOptionsWithSubmenu - All menu options with submenus
   * @param submenuRefs - References to all submenu popovers
   */
  const toggleSubmenu = async (
    option: MenuOption,
    event: Event,
    submenu: any, // Component instance with show/hide methods
    currentSubmenu: { value: string | null },
    menuOptionsWithSubmenu: MenuOption[],
    submenuRefs: Record<string, any> // Component instances
  ): Promise<void> => {
    if (!option.label || !option.hasSubmenu) return

    // Check if this submenu is currently open
    const isCurrentlyOpen = currentSubmenu.value === option.label

    // Hide all submenus first
    menuOptionsWithSubmenu.forEach((opt) => {
      const sm = submenuRefs[`submenu-${opt.label}`]
      if (sm) {
        sm.hide()
      }
    })
    currentSubmenu.value = null

    // If it wasn't open before, show it now
    if (!isCurrentlyOpen) {
      currentSubmenu.value = option.label
      await nextTick()

      const menuItem = event.currentTarget as HTMLElement
      const menuItemRect = menuItem.getBoundingClientRect()

      // Find the parent popover content element that contains this menu item
      const mainPopoverContent = menuItem.closest(
        '[data-pc-section="content"]'
      ) as HTMLElement

      if (mainPopoverContent) {
        const mainPopoverRect = mainPopoverContent.getBoundingClientRect()

        // Create a temporary positioned element as the target
        const tempTarget = createPositionedTarget(
          mainPopoverRect.right + 8,
          menuItemRect.top,
          `submenu-target-${option.label}`
        )

        // Create event using the temp target
        const tempEvent = createMouseEvent(
          mainPopoverRect.right + 8,
          menuItemRect.top
        )

        // Show submenu relative to temp target
        submenu.show(tempEvent, tempTarget)

        // Clean up temp target after a delay
        cleanupTempTarget(tempTarget, 100)
      } else {
        // Fallback: position to the right of the menu item
        const tempTarget = createPositionedTarget(
          menuItemRect.right + 8,
          menuItemRect.top,
          `submenu-fallback-target-${option.label}`
        )

        // Create event using the temp target
        const tempEvent = createMouseEvent(
          menuItemRect.right + 8,
          menuItemRect.top
        )

        // Show submenu relative to temp target
        submenu.show(tempEvent, tempTarget)

        // Clean up temp target after a delay
        cleanupTempTarget(tempTarget, 100)
      }
    }
  }

  /**
   * Create a temporary positioned DOM element for submenu targeting
   */
  const createPositionedTarget = (
    left: number,
    top: number,
    id: string
  ): HTMLElement => {
    const tempTarget = document.createElement('div')
    tempTarget.style.position = 'absolute'
    tempTarget.style.left = `${left}px`
    tempTarget.style.top = `${top}px`
    tempTarget.style.width = '1px'
    tempTarget.style.height = '1px'
    tempTarget.style.pointerEvents = 'none'
    tempTarget.style.visibility = 'hidden'
    tempTarget.id = id

    document.body.appendChild(tempTarget)
    return tempTarget
  }

  /**
   * Create a mouse event with specific coordinates
   */
  const createMouseEvent = (clientX: number, clientY: number): MouseEvent => {
    return new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY
    })
  }

  /**
   * Clean up temporary target element after delay
   */
  const cleanupTempTarget = (target: HTMLElement, delay: number): void => {
    setTimeout(() => {
      if (target.parentNode) {
        target.parentNode.removeChild(target)
      }
    }, delay)
  }

  /**
   * Hide all submenus
   */
  const hideAllSubmenus = (
    menuOptionsWithSubmenu: MenuOption[],
    submenuRefs: Record<string, any>, // Component instances
    currentSubmenu: { value: string | null }
  ): void => {
    menuOptionsWithSubmenu.forEach((option) => {
      const submenu = submenuRefs[`submenu-${option.label}`]
      if (submenu) {
        submenu.hide()
      }
    })
    currentSubmenu.value = null
  }

  return {
    toggleSubmenu,
    hideAllSubmenus
  }
}
