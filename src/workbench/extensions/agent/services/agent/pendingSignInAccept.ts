import { z } from 'zod'

// A consent accepted while signed out waits on the sign-in dialog in memory.
// Desktop can finish that sign-in outside the page and reload it while the
// dialog is still open, which drops the wait, so the accept and the held
// draft's text are also kept here: sessionStorage survives a same-window
// reload and nothing else. References and attachments are not kept; they
// point at live graph and upload state that a reload does not restore.
const STORAGE_KEY = 'Comfy.AgentPanel.PendingSignInAccept'
const PENDING_SIGN_IN_ACCEPT_TTL_MS = 10 * 60 * 1000

const zPendingSignInAccept = z.object({
  draft: z.string(),
  savedAt: z.number()
})
type PendingSignInAccept = z.infer<typeof zPendingSignInAccept>

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
    const parsed = zPendingSignInAccept.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const age = Date.now() - parsed.data.savedAt
    if (age < 0 || age > PENDING_SIGN_IN_ACCEPT_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}
