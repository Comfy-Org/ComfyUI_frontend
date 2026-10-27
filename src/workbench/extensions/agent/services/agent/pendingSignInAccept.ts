const STORAGE_KEY = 'Comfy.AgentPanel.PendingSignInAccept'

export function writePendingSignInAccept(draft: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ draft }))
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
    const draft = (stored as { draft?: unknown } | null)?.draft
    return typeof draft === 'string' ? draft : null
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
