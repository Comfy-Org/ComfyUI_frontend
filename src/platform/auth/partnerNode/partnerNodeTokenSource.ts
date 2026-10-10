import type { ExchangeTokenRequest } from '@comfyorg/ingest-types'
import { zExchangeTokenResponse } from '@comfyorg/ingest-types/zod'

import { reportError } from '@/platform/telemetry/reportError'

const PARTNER_NODE_RESOURCE = 'partner-node'

/**
 * Ingest route that revokes every partner-node session of the browser login
 * the presented partner-node token belongs to. The token is the credential,
 * so revoke still works after Firebase sign-out; an expired token is accepted.
 */
const PARTNER_NODE_REVOKE_ROUTE = '/auth/token/revoke'

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
  /** The identity token the mint is authorized with. */
  idToken: () => Promise<string | undefined>
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

type MintOutcome =
  | { ok: true; token: string; expiresAt: number }
  | { ok: false; reason: MintFailureReason; status?: number }

export function createPartnerNodeTokenSource({
  apiUrl,
  now = Date.now
}: PartnerNodeTokenSourceDeps) {
  const minted = new Map<string, MintedPartnerNodeToken>()
  const inFlight = new Map<string, Promise<string | undefined>>()
  let generation = 0

  const keyOf = ({ ownerUid, workspaceId }: PartnerNodeTokenTarget) =>
    `${ownerUid}:${workspaceId}`

  async function mint(target: PartnerNodeTokenTarget): Promise<MintOutcome> {
    const idToken = await target.idToken()
    if (!idToken) return { ok: false, reason: 'no_identity' }

    const body: PartnerNodeMintRequest = {
      workspace_id: target.workspaceId,
      resource: PARTNER_NODE_RESOURCE
    }
    let response: Response
    try {
      response = await fetch(apiUrl('/auth/token'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
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
    return {
      ok: true,
      token: parsed.data.token,
      expiresAt: Date.parse(parsed.data.expires_at)
    }
  }

  async function revokeWith(token: string): Promise<boolean> {
    try {
      const response = await fetch(apiUrl(PARTNER_NODE_REVOKE_ROUTE), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) return true
      reportError(new Error('Partner-node session revoke refused'), {
        surface: 'auth',
        errorType: 'failure_revoking_partner_node_sessions',
        level: 'warning',
        tags: { status: response.status }
      })
    } catch {
      reportError(new Error('Partner-node session revoke failed'), {
        surface: 'auth',
        errorType: 'failure_revoking_partner_node_sessions',
        level: 'warning',
        tags: { reason: 'network' }
      })
    }
    return false
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
   * Forgets every minted token and revokes the browser login's partner-node
   * sessions, one call per signed-in account that minted any.
   */
  async function revokeAll(): Promise<void> {
    generation += 1
    inFlight.clear()
    const tokenPerOwner = new Map<string, string>()
    for (const { ownerUid, token } of minted.values()) {
      tokenPerOwner.set(ownerUid, token)
    }
    minted.clear()
    await Promise.all([...tokenPerOwner.values()].map(revokeWith))
  }

  return { tokenFor, revokeAll }
}
