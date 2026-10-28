import { z } from 'zod'

const PENDING_KEY = 'Comfy.LocalWebSignIn.Pending'

const zPendingSignIn = z.object({
  verifier: z.string().min(1),
  state: z.string().min(1)
})

/** What this tab sent to the authorize endpoint, kept across the redirect. */
export type PendingSignIn = z.infer<typeof zPendingSignIn>

type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** False when storage refuses the write, so no redirect starts. */
export function savePendingSignIn(
  storage: SessionStore,
  pending: PendingSignIn
): boolean {
  try {
    storage.setItem(PENDING_KEY, JSON.stringify(pending))
    return true
  } catch {
    return false
  }
}

/** Reads and forgets the pending sign-in: a verifier is good for one try. */
export function takePendingSignIn(
  storage: SessionStore
): PendingSignIn | undefined {
  try {
    const raw = storage.getItem(PENDING_KEY)
    storage.removeItem(PENDING_KEY)
    if (raw === null) return undefined
    const parsed = zPendingSignIn.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}
