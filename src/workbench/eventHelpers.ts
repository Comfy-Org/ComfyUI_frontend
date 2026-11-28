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
