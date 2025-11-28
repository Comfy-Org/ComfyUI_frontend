interface MenuPositionStyle {
  position: 'fixed'
  left: string
  top?: string
  bottom?: string
  transform: string
}

interface MenuPositionOptions {
  /** The trigger element that opened the menu */
  triggerRect: DOMRect
  /** The menu overlay element */
  menuElement: HTMLElement
  /** Whether the menu was triggered by the toolbox button */
  isTriggeredByToolbox: boolean
  /** Margin from trigger element */
  marginY?: number
}

/**
 * Calculates viewport-aware menu positioning that prevents overflow.
 * When a menu would overflow the bottom of the viewport, it docks to the bottom instead.
 *
 * @returns Positioning style properties to apply to the menu element
 */
export function calculateMenuPosition(
  options: MenuPositionOptions
): MenuPositionStyle {
  const {
    triggerRect,
    menuElement,
    isTriggeredByToolbox,
    marginY = 8
  } = options

  // Calculate horizontal position (same as before)
  const left = isTriggeredByToolbox
    ? triggerRect.left + triggerRect.width / 2
    : triggerRect.right - triggerRect.width / 4

  // Calculate initial top position
  const initialTop = isTriggeredByToolbox
    ? triggerRect.bottom + marginY
    : triggerRect.top - marginY - 6

  // Get menu dimensions
  const menuHeight = menuElement.offsetHeight || menuElement.scrollHeight
  const viewportHeight = window.innerHeight

  // Calculate available space below the trigger point
  const spaceBelow = viewportHeight - initialTop

  // Check if menu would overflow viewport bottom
  const wouldOverflow = menuHeight > spaceBelow

  const baseStyle: MenuPositionStyle = {
    position: 'fixed',
    left: `${left}px`,
    transform: 'translate(-50%, 0)'
  }

  if (triggerRect.top < 0) {
    // Dock to top of viewport if node is above
    return {
      ...baseStyle,
      top: '0px'
    }
  } else if (wouldOverflow) {
    // Dock to bottom of viewport
    return {
      ...baseStyle,
      bottom: '0px'
    }
  } else {
    // Position below trigger as normal
    return {
      ...baseStyle,
      top: `${initialTop}px`
    }
  }
}
