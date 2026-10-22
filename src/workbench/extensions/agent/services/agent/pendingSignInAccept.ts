// A consent accepted while signed out waits on the sign-in dialog in memory.
// Desktop can finish that sign-in outside the page and reload it, which drops
// the wait, so the accept and the held draft are also kept here: sessionStorage
// survives a same-window reload and nothing else.
const STORAGE_KEY = 'Comfy.AgentPanel.PendingSignInAccept'
const PENDING_SIGN_IN_ACCEPT_TTL_MS = 10 * 60 * 1000

interface PendingSignInAccept {
  draft: string
  savedAt: number
}

function storage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function writePendingSignInAccept(draft: string): void {
  const record: PendingSignInAccept = { draft, savedAt: Date.now() }
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // Storage full or blocked: the in-memory path still works without a reload.
  }
}

export function clearPendingSignInAccept(): void {
  try {
    storage()?.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export function hasPendingSignInAccept(): boolean {
  try {
    return storage()?.getItem(STORAGE_KEY) != null
  } catch {
    return false
  }
}

/** Reads and removes the record; null when absent, malformed or expired. */
export function takePendingSignInAccept(): PendingSignInAccept | null {
  let raw: string | null | undefined
  try {
    raw = storage()?.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  clearPendingSignInAccept()
  if (!raw) return null
  try {
    const record: unknown = JSON.parse(raw)
    if (
      typeof record !== 'object' ||
      record === null ||
      !('draft' in record) ||
      !('savedAt' in record) ||
      typeof record.draft !== 'string' ||
      typeof record.savedAt !== 'number'
    )
      return null
    const age = Date.now() - record.savedAt
    if (age < 0 || age > PENDING_SIGN_IN_ACCEPT_TTL_MS) return null
    return { draft: record.draft, savedAt: record.savedAt }
  } catch {
    return null
  }
}
