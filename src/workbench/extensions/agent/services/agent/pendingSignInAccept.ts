import { z } from 'zod'

const STORAGE_KEY = 'Comfy.AgentPanel.PendingSignInAccept'
const PENDING_SIGN_IN_ACCEPT_TTL_MS = 10 * 60 * 1000

const zPendingSignInAccept = z.object({
  draft: z.string(),
  savedAt: z.number()
})
type PendingSignInAccept = z.infer<typeof zPendingSignInAccept>

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

function readPendingSignInAccept(): PendingSignInAccept | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = zPendingSignInAccept.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const age = Date.now() - parsed.data.savedAt
    return age >= 0 && age <= PENDING_SIGN_IN_ACCEPT_TTL_MS
      ? parsed.data
      : null
  } catch {
    return null
  }
}

export function hasPendingSignInAccept(): boolean {
  return readPendingSignInAccept() !== null
}

export function takePendingSignInAccept(): PendingSignInAccept | null {
  const pending = readPendingSignInAccept()
  clearPendingSignInAccept()
  return pending
}
