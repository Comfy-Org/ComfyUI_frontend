// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
/**
 * Utility functions for handling workbench events
 */

function activeTextSelection(): Selection | null {
  const selection = window.getSelection()
  return selection !== null && !selection.isCollapsed ? selection : null
}

export function hasTextSelection(target: EventTarget | null): boolean {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    if (
      target.selectionStart !== null &&
      target.selectionEnd !== null &&
      target.selectionStart !== target.selectionEnd
    )
      return true
  }

  return activeTextSelection() !== null
}

function rangesOf(selection: Selection): Range[] {
  return Array.from({ length: selection.rangeCount }, (_, i) =>
    selection.getRangeAt(i)
  )
}

/**
 * Collapse a text selection unless every range lies wholly inside
 * `container`, the way a plain mousedown would before the canvas called
 * `preventDefault()` on it. A copy or paste that follows a click on the graph
 * then reaches the graph instead of the stale selection.
 */
export function collapseTextSelectionOutside(container: Element): void {
  const selection = activeTextSelection()
  if (
    selection &&
    rangesOf(selection).some(
      (range) =>
        !container.contains(range.startContainer) ||
        !container.contains(range.endContainer)
    )
  )
    selection.removeAllRanges()
}

export function collapseOutsideSelectionOnPrimaryPointerDown(
  event: PointerEvent
): void {
  if (event.button === 0 && event.target instanceof Element)
    collapseTextSelectionOutside(event.target)
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
        'submit'
      ].includes(target.type))
  return (
    isTextInput || useCanvasStore().linearMode || activeTextSelection() !== null
  )
}
