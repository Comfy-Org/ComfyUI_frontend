const STORAGE_KEY = 'Comfy.AgentPanel.PendingSignInAccept'

export function writePendingSignInAccept(draft: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, draft)
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

export function hasPendingSignInAccept(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}

export function takePendingSignInAccept(): string | null {
  try {
    const draft = window.sessionStorage.getItem(STORAGE_KEY)
    window.sessionStorage.removeItem(STORAGE_KEY)
    return draft
  } catch {
    return null
  }
}
