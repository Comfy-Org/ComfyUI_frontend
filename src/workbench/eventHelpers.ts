// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
/**
 * Utility functions for handling workbench events
 */

function selectedText(): Selection | null {
  const selection = window.getSelection()
  return selection !== null && selection.toString().trim().length > 0
    ? selection
    : null
}

/**
 * Collapse a text selection that starts outside `container`, the way a plain
 * mousedown would before the canvas called `preventDefault()` on it. A copy
 * or paste that follows a click on the graph then reaches the graph instead
 * of the stale selection.
 */
export function collapseTextSelectionOutside(container: Element): void {
  const selection = selectedText()
  if (selection?.anchorNode && !container.contains(selection.anchorNode))
    selection.removeAllRanges()
}

/**
 * Used by clipboard handlers to determine if copy/paste events should be
 * intercepted for graph operations vs. allowing default browser behavior
 * for text inputs and other UI elements.
 *
 * @param target - The event target to check
 * @returns true if copy paste events will be handled by target
 */
export function shouldIgnoreCopyPaste(target: EventTarget | null): boolean {
  const isTextInput =
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable) ||
    (target instanceof HTMLInputElement &&
      ![
        'button',
        'checkbox',
        'file',
        'hidden',
        'image',
        'radio',
        'range',
        'reset',
        'search',
        'submit'
      ].includes(target.type))
  return isTextInput || useCanvasStore().linearMode || selectedText() !== null
}
