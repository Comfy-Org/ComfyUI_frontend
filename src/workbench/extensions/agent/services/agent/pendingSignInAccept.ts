const STORAGE_KEY = 'Comfy.AgentPanel.PendingSignInAccept'
const PENDING_SIGN_IN_ACCEPT_TTL_MS = 10 * 60 * 1000

export function writePendingSignInAccept(draft: string): void {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ draft, savedAt: Date.now() })
    )
  } catch {
    return
  }
}

export function clearPendingSignInAccept(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

function readPendingSignInAccept(): string | null {
  try {
    const stored: unknown = JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEY) ?? 'null'
    )
    const { draft, savedAt } = (stored ?? {}) as {
      draft?: unknown
      savedAt?: unknown
    }
    if (typeof draft !== 'string' || typeof savedAt !== 'number') return null
    const age = Date.now() - savedAt
    return age >= 0 && age <= PENDING_SIGN_IN_ACCEPT_TTL_MS ? draft : null
  } catch {
    return null
  }
}

export function hasPendingSignInAccept(): boolean {
  return readPendingSignInAccept() !== null
}

export function takePendingSignInAccept(): string | null {
  const draft = readPendingSignInAccept()
  clearPendingSignInAccept()
  return draft
}
