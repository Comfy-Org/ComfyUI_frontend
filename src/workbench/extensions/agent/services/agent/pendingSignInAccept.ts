import { z } from 'zod'

const STORAGE_KEY = 'Comfy.AgentPanel.PendingSignInAccept'
const PENDING_SIGN_IN_ACCEPT_TTL_MS = 10 * 60 * 1000

const zPendingSignInAccept = z.object({
  draft: z.string(),
  savedAt: z.number()
})
type PendingSignInAccept = z.infer<typeof zPendingSignInAccept>

function withSessionStorage<T>(use: (storage: Storage) => T, fallback: T): T {
  try {
    return use(window.sessionStorage)
  } catch {
    return fallback
  }
}

function parseLive(raw: string | null): PendingSignInAccept | null {
  if (!raw) return null
  try {
    const parsed = zPendingSignInAccept.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const age = Date.now() - parsed.data.savedAt
    return age >= 0 && age <= PENDING_SIGN_IN_ACCEPT_TTL_MS ? parsed.data : null
  } catch {
    return null
  }
}

export function writePendingSignInAccept(draft: string): void {
  const record: PendingSignInAccept = { draft, savedAt: Date.now() }
  withSessionStorage(
    (storage) => storage.setItem(STORAGE_KEY, JSON.stringify(record)),
    undefined
  )
}

export function clearPendingSignInAccept(): void {
  withSessionStorage((storage) => storage.removeItem(STORAGE_KEY), undefined)
}

export function hasPendingSignInAccept(): boolean {
  return withSessionStorage(
    (storage) => storage.getItem(STORAGE_KEY) !== null,
    false
  )
}

/** The kept accept, left in place; an absent, malformed or expired one is cleared and null. */
export function readPendingSignInAccept(): PendingSignInAccept | null {
  const pending = parseLive(
    withSessionStorage((storage) => storage.getItem(STORAGE_KEY), null)
  )
  if (!pending) clearPendingSignInAccept()
  return pending
}
