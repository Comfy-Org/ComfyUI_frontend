/**
 * Calculate the intrinsic (minimum content-based) size of a node element
 *
 * Temporarily sets the element to auto-size to measure its natural content dimensions,
 * then converts from screen coordinates to canvas coordinates using the camera scale.
 *
 * @param element - The node element to measure
 * @param scale - Camera zoom scale for coordinate conversion
 * @returns The intrinsic minimum size in canvas coordinates
 */
export function calculateIntrinsicSize(element: HTMLElement): {
  width: number
  height: number
} {
  // Store original size to restore later
  const originalWidth = element.style.width
  const originalHeight = element.style.height

  // Temporarily set to auto to measure natural content size
  element.style.width = 'min-content'
  element.style.height = 'min-content'

  const intrinsicRect = {
    width: element.clientWidth,
    height: element.clientHeight
  }

  // Restore original size
  element.style.width = originalWidth
  element.style.height = originalHeight
  const widgets = [
    ...element.querySelectorAll('.lg-node-widgets > div > div:nth-child(2)')
  ]

  const widgetHeight = () => {
    return widgets.map((w) => w.clientHeight).reduce((a, b) => a + b, 0)
  }
  const withoutWidgets = intrinsicRect.height - widgetHeight()

  // Convert from screen coordinates to canvas coordinates
  return {
    width: intrinsicRect.width,
    get height() {
      return withoutWidgets + widgetHeight()
    }
  }
}
