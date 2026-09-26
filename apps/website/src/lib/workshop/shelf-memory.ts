import type { UseCase } from '../../config/models-catalogue'
import { USE_CASES } from '../../config/models-catalogue'

export type Shelf = UseCase | 'all' | 'other'

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

// A middle, modified or right click opens the model somewhere else, and the
// visitor stays on the shelf they are standing on.
export function rememberShelfOnClick(
  shelf: Shelf,
  modelHref: string,
  event: MouseEvent
): void {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  rememberShelf(shelf, modelHref)
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
  if (value === 'all' || value === 'other') return value
  return typeof value === 'string'
    ? USE_CASES.find((useCase) => useCase === value)
    : undefined
}

function isShelfReturn(value: unknown): value is ShelfReturn {
  if (!value || typeof value !== 'object') return false
  if (!('shelf' in value) || !('modelPath' in value)) return false
  return (
    asShelf(value.shelf) !== undefined && typeof value.modelPath === 'string'
  )
}
