// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
/**
 * Utility functions for handling workbench events
 */

/**
 * Whether the user has selected text that a copy or paste should act on
 * instead of the graph: any selection when nothing specific has focus, or a
 * selection inside the focused element. A selection elsewhere (the agent
 * transcript, a side panel) does not claim a copy or paste aimed at the canvas.
 */
function hasTextSelectionFor(target: EventTarget | null): boolean {
  const selection = window.getSelection()
  if (selection === null || selection.toString().trim().length === 0)
    return false
  if (!(target instanceof Element) || target === document.body) return true
  return selection.anchorNode !== null && target.contains(selection.anchorNode)
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
  return (
    isTextInput || useCanvasStore().linearMode || hasTextSelectionFor(target)
  )
}
