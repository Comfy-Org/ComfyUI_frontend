const KEY = 'comfy-hub-list'

/** The list a model was opened from, for the way back to it. */
export interface ListReturn {
  readonly href: string
  readonly label?: string
}

interface StoredReturn extends ListReturn {
  readonly modelPath: string
}

function rememberList(list: ListReturn, modelHref: string): void {
  try {
    const modelPath = new URL(modelHref, window.location.origin).pathname
    const stored: StoredReturn = { ...list, modelPath }
    sessionStorage.setItem(KEY, JSON.stringify(stored))
  } catch {
    return
  }
}

/** Remembers the list a model is opened from, unless the click opens it elsewhere. */
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

/** The list remembered for this model page, consumed so it serves one navigation. */
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSameSitePath(href: unknown): href is string {
  return (
    typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')
  )
}

function isStoredReturn(value: unknown): value is StoredReturn {
  if (!isRecord(value)) return false
  const { href, label, modelPath } = value
  return (
    isSameSitePath(href) &&
    typeof modelPath === 'string' &&
    (label === undefined || typeof label === 'string')
  )
}
