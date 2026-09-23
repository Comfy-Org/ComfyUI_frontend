/**
 * A shelf key, or `all` for the catalogue entire and `other` for what no shelf
 * claimed. Which keys are shelves depends on the half the reader was in, so
 * the memory keeps the key and the page it returns to resolves it.
 */
export type Shelf = string

const KEY = 'comfy-models-shelf'

interface ShelfReturn {
  readonly shelf: Shelf
  readonly modelPath: string
}

// Remember a return destination only when a model is actually opened. Merely
// browsing a shelf must not leave stale state that changes a later direct link.
export function rememberShelf(shelf: Shelf, modelHref: string): void {
  try {
    const modelPath = new URL(modelHref, window.location.origin).pathname
    sessionStorage.setItem(KEY, JSON.stringify({ shelf, modelPath }))
  } catch {
    // A browser that refuses storage still browses; it just starts each page
    // from the whole catalogue.
  }
}

// Only a plain left click is this navigation. A new tab, or a click the
// browser handles some other way, leaves this page where it is, so recording a
// return from it would answer a question nobody asked.
export function rememberShelfOnClick(
  event: MouseEvent,
  shelf: Shelf,
  modelHref: string
): void {
  const handledElsewhere =
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  if (!handledElsewhere) rememberShelf(shelf, modelHref)
}

// The intent belongs to one navigation. Matching the destination prevents an
// old shelf from leaking onto a shared link; consuming it prevents a reload or
// an unrelated later visit from reusing it.
export function lastShelf(modelPath: string): Shelf | undefined {
  try {
    const stored = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    if (!stored) return undefined
    const parsed: unknown = JSON.parse(stored)
    if (!isShelfReturn(parsed) || parsed.modelPath !== modelPath)
      return undefined
    return parsed.shelf
  } catch {
    return undefined
  }
}

function asShelf(value: unknown): Shelf | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function isShelfReturn(value: unknown): value is ShelfReturn {
  if (!value || typeof value !== 'object') return false
  if (!('shelf' in value) || !('modelPath' in value)) return false
  return (
    asShelf(value.shelf) !== undefined && typeof value.modelPath === 'string'
  )
}
