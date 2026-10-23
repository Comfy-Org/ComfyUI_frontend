import type { ExchangeTokenRequest } from '@comfyorg/ingest-types'
import {
  zErrorResponse,
  zExchangeTokenResponse
} from '@comfyorg/ingest-types/zod'

import { reportError } from '@/platform/telemetry/reportError'

const PARTNER_NODE_RESOURCE = 'partner-node'

/**
 * Ingest route that revokes partner-node sessions. A sign-in credential
 * revokes every session of that login, including ones an earlier page load
 * minted; a partner-node token (even expired) revokes only its own session.
 */
const PARTNER_NODE_REVOKE_ROUTE = '/auth/token/revoke'

/** An ingest that predates sign-in revoke refuses the sign-in with this code. */
const SIGN_IN_REVOKE_UNSUPPORTED = 'auth_type_not_allowed'

/** A cached token is reused only while it has at least this much life left. */
export const PARTNER_NODE_REUSE_MIN_REMAINING_MS = 60 * 60 * 1000

type PartnerNodeMintRequest = ExchangeTokenRequest & {
  workspace_id: string
  resource: typeof PARTNER_NODE_RESOURCE
}

const zPartnerNodeTokenResponse = zExchangeTokenResponse.pick({
  token: true,
  expires_at: true,
  workspace: true
})

export interface PartnerNodeTokenTarget {
  ownerUid: string
  workspaceId: string
  /** Mint bearer: a Firebase ID token or a host OAuth access token. */
  credential: () => Promise<string | undefined>
}

interface PartnerNodeTokenSourceDeps {
  apiUrl: (route: string) => string
  now?: () => number
}

interface MintedPartnerNodeToken {
  ownerUid: string
  token: string
  expiresAt: number
}

type MintFailureReason =
  | 'no_identity'
  | 'network'
  | 'http'
  | 'malformed'
  | 'workspace_mismatch'
  | 'expired'

type RevokeOutcome =
  | { ok: true }
  | { ok: false; reason: 'network' }
  | { ok: false; reason: 'http'; status: number; code?: string }

type MintOutcome =
  | { ok: true; token: string; expiresAt: number }
  | { ok: false; reason: MintFailureReason; status?: number }

export function createPartnerNodeTokenSource({
  apiUrl,
  now = () => Date.now()
}: PartnerNodeTokenSourceDeps) {
  const minted = new Map<string, MintedPartnerNodeToken>()
  const inFlight = new Map<string, Promise<string | undefined>>()
  let generation = 0

  const keyOf = ({ ownerUid, workspaceId }: PartnerNodeTokenTarget) =>
    `${ownerUid}:${workspaceId}`

  async function mint(target: PartnerNodeTokenTarget): Promise<MintOutcome> {
    const credential = await target.credential()
    if (!credential) return { ok: false, reason: 'no_identity' }

    const body: PartnerNodeMintRequest = {
      workspace_id: target.workspaceId,
      resource: PARTNER_NODE_RESOURCE
    }
    let response: Response
    try {
      response = await fetch(apiUrl('/auth/token'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credential}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
    } catch {
      return { ok: false, reason: 'network' }
    }
    if (!response.ok) {
      return { ok: false, reason: 'http', status: response.status }
    }

    let json: unknown
    try {
      json = await response.json()
    } catch {
      return { ok: false, reason: 'malformed' }
    }
    const parsed = zPartnerNodeTokenResponse.safeParse(json)
    if (!parsed.success) return { ok: false, reason: 'malformed' }
    if (parsed.data.workspace.id !== target.workspaceId) {
      return { ok: false, reason: 'workspace_mismatch' }
    }
    const expiresAt = Date.parse(parsed.data.expires_at)
    if (!(expiresAt > now())) return { ok: false, reason: 'expired' }
    return { ok: true, token: parsed.data.token, expiresAt }
  }

  async function requestRevoke(bearer: string): Promise<RevokeOutcome> {
    let response: Response
    try {
      response = await fetch(apiUrl(PARTNER_NODE_REVOKE_ROUTE), {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer}` }
      })
    } catch {
      return { ok: false, reason: 'network' }
    }
    if (response.ok) return { ok: true }
    const body: unknown = await response.json().catch(() => undefined)
    const code = zErrorResponse.safeParse(body).data?.code
    return { ok: false, reason: 'http', status: response.status, code }
  }

  function reportRevokeFailure(
    outcome: Exclude<RevokeOutcome, { ok: true }>
  ): void {
    reportError(new Error('Partner-node session revoke failed'), {
      surface: 'auth',
      errorType: 'failure_revoking_partner_node_sessions',
      level: 'warning',
      tags:
        outcome.reason === 'http'
          ? { reason: outcome.reason, status: outcome.status }
          : { reason: outcome.reason }
    })
  }

  async function revokeWith(token: string): Promise<void> {
    const outcome = await requestRevoke(token)
    if (!outcome.ok) reportRevokeFailure(outcome)
  }

  /** Forgets every minted token, returning one held token per account. */
  function forgetAll(): string[] {
    generation += 1
    inFlight.clear()
    const tokenPerOwner = new Map<string, string>()
    for (const { ownerUid, token } of minted.values()) {
      tokenPerOwner.set(ownerUid, token)
    }
    minted.clear()
    return [...tokenPerOwner.values()]
  }

  function reusableToken(key: string): string | undefined {
    const entry = minted.get(key)
    if (!entry) return undefined
    return entry.expiresAt - now() > PARTNER_NODE_REUSE_MIN_REMAINING_MS
      ? entry.token
      : undefined
  }

  /**
   * A partner-node token for the target, reused while it has comfortable life
   * left, minted once for concurrent callers. Undefined when minting failed,
   * so the caller keeps the workspace token.
   */
  function tokenFor(
    target: PartnerNodeTokenTarget
  ): Promise<string | undefined> {
    const key = keyOf(target)
    const reusable = reusableToken(key)
    if (reusable) return Promise.resolve(reusable)
    const pending = inFlight.get(key)
    if (pending) return pending

    const mintGeneration = generation
    const request = mint(target).then((outcome) => {
      if (!outcome.ok) {
        reportError(new Error('Partner-node token mint failed'), {
          surface: 'auth',
          errorType: 'failure_minting_partner_node_token',
          level: 'warning',
          tags: { reason: outcome.reason, status: outcome.status }
        })
        return undefined
      }
      if (mintGeneration !== generation) {
        void revokeWith(outcome.token)
        return undefined
      }
      minted.set(key, {
        ownerUid: target.ownerUid,
        token: outcome.token,
        expiresAt: outcome.expiresAt
      })
      return outcome.token
    })
    inFlight.set(key, request)
    void request.finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key)
    })
    return request
  }

  /**
   * Forgets every minted token and revokes with the ones this page load still
   * holds. Used when the sign-in credential is already gone.
   */
  async function revokeAll(): Promise<void> {
    await Promise.all(forgetAll().map(revokeWith))
  }

  /**
   * Forgets every minted token and revokes every partner-node session of the
   * login `credential` signed in, whichever page load minted them. Falls back
   * to the held tokens when there is no credential or the ingest does not
   * take a sign-in on this route yet.
   */
  async function revokeLogin(credential: string | undefined): Promise<void> {
    const held = forgetAll()
    if (credential) {
      const outcome = await requestRevoke(credential)
      if (outcome.ok) return
      const signInUnsupported =
        outcome.reason === 'http' && outcome.code === SIGN_IN_REVOKE_UNSUPPORTED
      if (!signInUnsupported) {
        reportRevokeFailure(outcome)
        return
      }
    }
    await Promise.all(held.map(revokeWith))
  }

  return { tokenFor, revokeAll, revokeLogin }
}
