/**
 * Utility functions for handling workbench events
 */

/**
 * Checks if an event target is within the graph canvas or related UI elements
 * (minimap, canvas controls, etc.)
 *
 * Used by clipboard handlers to determine if copy/paste events should be
 * intercepted for graph operations vs. allowing default browser behavior
 * for text inputs and other UI elements.
 *
 * @param target - The event target to check
 * @returns true if the target is within graph-related UI elements
 */
export function isEventTargetInGraph(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }

  return (
    target.id === 'graph-canvas' ||
    target.id === 'comfy-minimap' ||
    target.id === 'graph-canvas-controls' ||
    target.classList.contains('graph-canvas-container') ||
    target.classList.contains('litegraph') ||
    target.closest('#comfy-minimap') !== null ||
    target.closest('#graph-canvas-controls') !== null ||
    target.closest('#graph-canvas-container') !== null
  )
}
