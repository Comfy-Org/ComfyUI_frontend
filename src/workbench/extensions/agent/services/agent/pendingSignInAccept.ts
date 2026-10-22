import { z } from 'zod'

import { createUuidv4 } from '@/utils/uuid'

const STORAGE_KEY = 'Comfy.AgentPanel.PendingSignInAccept'
const PENDING_SIGN_IN_ACCEPT_TTL_MS = 10 * 60 * 1000

const zPendingSignInAccept = z.object({
  id: z.string().optional(),
  draft: z.string(),
  savedAt: z.number(),
  scope: z
    .object({ userId: z.string(), workspaceId: z.string().optional() })
    .optional()
})
export type PendingSignInAccept = z.infer<typeof zPendingSignInAccept>
type WriteResult =
  | { ok: true; pending: PendingSignInAccept }
  | { ok: false; error: unknown }

function save(record: PendingSignInAccept): WriteResult {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    return { ok: true, pending: record }
  } catch (error) {
    return { ok: false, error }
  }
}

export function writePendingSignInAccept(draft: string): WriteResult {
  try {
    return save({ id: createUuidv4(), draft, savedAt: Date.now() })
  } catch (error) {
    return { ok: false, error }
  }
}

export function clearPendingSignInAccept(pending?: PendingSignInAccept): void {
  try {
    if (pending && !ownsPendingSignInAccept(pending)) return
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

export function ownsPendingSignInAccept(pending: PendingSignInAccept): boolean {
  const current = readPendingSignInAccept()
  return (
    current !== null &&
    current.id === pending.id &&
    current.savedAt === pending.savedAt &&
    current.draft === pending.draft
  )
}

export function bindPendingSignInAccept(
  pending: PendingSignInAccept,
  scope: NonNullable<PendingSignInAccept['scope']>
): WriteResult {
  return save({ ...pending, scope })
}

export function hasPendingSignInAccept(): boolean {
  return readPendingSignInAccept() !== null
}

export function readPendingSignInAccept(): PendingSignInAccept | null {
  let raw: string | null
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const parsed = zPendingSignInAccept.safeParse(JSON.parse(raw))
    if (parsed.success) {
      const age = Date.now() - parsed.data.savedAt
      if (age >= 0 && age <= PENDING_SIGN_IN_ACCEPT_TTL_MS) return parsed.data
    }
  } catch {
    clearPendingSignInAccept()
    return null
  }
  clearPendingSignInAccept()
  return null
}
