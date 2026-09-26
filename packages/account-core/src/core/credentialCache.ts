import { z } from 'zod'

import { CredentialResponseSchema } from './exchange.js'
import type { AccountCredential } from './sessionContracts.js'

/**
 * Raw string storage for the credential cache. Hosts wrap their medium —
 * per-tab browser storage today, a cookie-backed session tomorrow. Each client
 * instance sees only its own storage: signing out in one tab leaves another
 * tab's session live until the server revokes it and the next remint 401s.
 */
export interface CredentialStorage {
  read: () => string | null
  write: (value: string) => void
  clear: () => void
}

/** The generated contract for POST /api/auth/token, never a local copy of it. */
const CachedCredentialSchema = CredentialResponseSchema.omit({
  expires_at: true
}).extend({
  // Storage and broadcast are untrusted boundaries: an empty token can never
  // authorize and a non-finite expiry can never lapse, so neither is a session.
  token: z.string().min(1),
  expiresAt: z.number().finite(),
  uid: z.string(),
  /** The workspace target the credential was minted for; absent = personal. */
  target: z.string().optional()
})

interface CachedCredential {
  readonly credential: AccountCredential
  readonly target: string | undefined
}

function toCredential(
  data: z.infer<typeof CachedCredentialSchema>
): AccountCredential {
  return {
    token: data.token,
    expiresAt: data.expiresAt,
    uid: data.uid,
    workspace: data.workspace,
    role: data.role,
    permissions: data.permissions
  }
}

export function encodeCached(
  session: AccountCredential,
  target: string | undefined
): string {
  return JSON.stringify({ ...session, target })
}

export function decodeCached(
  raw: string,
  uid: string
): CachedCredential | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  const result = CachedCredentialSchema.safeParse(parsed)
  if (!result.success || result.data.uid !== uid) return undefined
  return { credential: toCredential(result.data), target: result.data.target }
}

export function decodeAdopted(message: unknown): AccountCredential | undefined {
  const parsed = CachedCredentialSchema.safeParse(message)
  return parsed.success ? toCredential(parsed.data) : undefined
}

interface CredentialCache {
  read: (uid: string) => CachedCredential | undefined
  write: (session: AccountCredential, target: string | undefined) => void
  clear: () => void
}

export const DEFAULT_FRESH_MARGIN_MS = 5 * 60 * 1000

export function isCredentialFresh(
  session: AccountCredential,
  now: number,
  freshMarginMs: number = DEFAULT_FRESH_MARGIN_MS
): boolean {
  return session.expiresAt - now > freshMarginMs
}

interface CredentialCandidate {
  readonly credential: AccountCredential | undefined
  readonly target: string | undefined
}

/**
 * The live credential is authoritative; storage is recovery state, not a
 * competing source. Candidates are consulted in the order given (memory
 * first, then storage) for this exact uid and target, and the first fresh one
 * wins — expiry must not override this (a rejected token can outlive its
 * shorter-lived replacement), and a target-less read must never adopt a team
 * session.
 */
export function selectFreshCredential(
  candidates: readonly (() => CredentialCandidate | undefined)[],
  uid: string,
  target: string | undefined,
  now: number,
  freshMarginMs: number
): AccountCredential | undefined {
  for (const supply of candidates) {
    const candidate = supply()
    if (
      candidate?.credential?.uid === uid &&
      candidate.target === target &&
      isCredentialFresh(candidate.credential, now, freshMarginMs)
    ) {
      return candidate.credential
    }
  }
  return undefined
}

export function createCredentialCache(
  storage: CredentialStorage
): CredentialCache {
  return {
    read(uid) {
      let raw: string | null
      try {
        raw = storage.read()
      } catch {
        return undefined
      }
      return raw === null ? undefined : decodeCached(raw, uid)
    },
    write(session, target) {
      try {
        storage.write(encodeCached(session, target))
      } catch {
        void 0
      }
    },
    clear() {
      try {
        storage.clear()
      } catch {
        void 0
      }
    }
  }
}
