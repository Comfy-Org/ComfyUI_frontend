import type { UseCase } from '@/config/models-catalogue'

export type Shelf = UseCase | 'all' | 'other'

const KEY = 'comfy-models-shelf'

/** The list a model was opened from, for the way back to it. */
export interface ListReturn {
  /** Path and query of the list, as the visitor saw it. */
  readonly href: string
  /** What to call the list; without one the page's own fallback names it. */
  readonly label?: string
}

interface StoredReturn extends ListReturn {
  readonly modelPath: string
}

// Remember a return destination only when a model is actually opened. Merely
// browsing a list must not leave stale state that changes a later direct link.
export function rememberList(list: ListReturn, modelHref: string): void {
  try {
    const modelPath = new URL(modelHref, window.location.origin).pathname
    const stored: StoredReturn = { ...list, modelPath }
    sessionStorage.setItem(KEY, JSON.stringify(stored))
  } catch {
    // A browser that refuses storage still browses; it just starts each page
    // from the whole catalogue.
  }
}

// A middle, modified or right click opens the model somewhere else, and the
// visitor stays on the list they are standing on.
export function rememberListOnClick(
  list: ListReturn,
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
  rememberList(list, modelHref)
}

// The intent belongs to one navigation. Matching the destination prevents an
// old list from leaking onto a shared link; consuming it prevents a reload or
// an unrelated later visit from reusing it.
export function lastList(modelPath: string): ListReturn | undefined {
  try {
    const stored = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    if (!stored) return undefined
    const parsed: unknown = JSON.parse(stored)
    if (!isStoredReturn(parsed) || parsed.modelPath !== modelPath)
      return undefined
    return parsed.label === undefined
      ? { href: parsed.href }
      : { href: parsed.href, label: parsed.label }
  } catch {
    return undefined
  }
}

function isStoredReturn(value: unknown): value is StoredReturn {
  if (!value || typeof value !== 'object') return false
  if (!('href' in value) || !('modelPath' in value)) return false
  const label = 'label' in value ? value.label : undefined
  return (
    typeof value.href === 'string' &&
    value.href.startsWith('/') &&
    !value.href.startsWith('//') &&
    typeof value.modelPath === 'string' &&
    (label === undefined || typeof label === 'string')
  )
}
