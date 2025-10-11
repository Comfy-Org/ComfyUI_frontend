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
export function calculateIntrinsicSize(
  element: HTMLElement,
  scale: number
): { width: number; height: number } {
  // Store original size to restore later
  const originalWidth = element.style.width
  const originalHeight = element.style.height

  // Temporarily set to auto to measure natural content size
  element.style.width = 'auto'
  element.style.height = 'auto'

  const intrinsicRect = element.getBoundingClientRect()

  // Restore original size
  element.style.width = originalWidth
  element.style.height = originalHeight

  // Convert from screen coordinates to canvas coordinates
  return {
    width: intrinsicRect.width / scale,
    height: intrinsicRect.height / scale
  }
}
