export function createCursorCache(element: HTMLElement) {
  let lastCursor = ''
  return function setCursor(cursor: string) {
    if (cursor === lastCursor) return
    lastCursor = cursor
    element.style.cursor = cursor
  }
}
