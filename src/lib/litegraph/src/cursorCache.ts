export function createCursorCache() {
  let lastCursor = ''
  return function setCursor(cursor: string, element: HTMLElement) {
    if (cursor === lastCursor) return
    lastCursor = cursor
    element.style.cursor = cursor
  }
}
