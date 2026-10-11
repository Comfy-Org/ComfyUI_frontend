import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { describe, expect, it, vi } from 'vitest'

import {
  PARTNER_NODE_REUSE_MIN_REMAINING_MS,
  createPartnerNodeTokenSource
} from '@/platform/auth/partnerNode/partnerNodeTokenSource'
import type { PartnerNodeTokenTarget } from '@/platform/auth/partnerNode/partnerNodeTokenSource'
import { reportError } from '@/platform/telemetry/reportError'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const MINT_URL = 'https://cloud.test/api/auth/token'
const REVOKE_URL = 'https://cloud.test/api/auth/token/revoke'
const NOW = Date.parse('2026-10-10T00:00:00Z')
const MINUTE = 60 * 1000

function mintResponse(
  token: string,
  { workspaceId = 'ws-a', lifetimeMs = 90 * MINUTE } = {}
) {
  return Response.json({
    token,
    expires_at: new Date(NOW + lifetimeMs).toISOString(),
    workspace: { id: workspaceId, name: 'Team', type: 'team' },
    role: 'owner',
    permissions: []
  })
}

function setup() {
  let now = NOW
  const source = createPartnerNodeTokenSource({
    apiUrl: (route) => `https://cloud.test/api${route}`,
    now: () => now
  })
  return {
    source,
    advance: (ms: number) => {
      now += ms
    }
  }
}

const target = (
  overrides: Partial<PartnerNodeTokenTarget> = {}
): PartnerNodeTokenTarget => ({
  ownerUid: 'user-a',
  workspaceId: 'ws-a',
  idToken: async () => 'firebase-id-token',
  ...overrides
})

describe('createPartnerNodeTokenSource', () => {
  it('mints with the identity token and the partner-node resource', async () => {
    respondToFetch(MINT_URL, () => mintResponse('pn-1'))
    const { source } = setup()

    await expect(source.tokenFor(target())).resolves.toBe('pn-1')

    const [request] = fetchRequests(MINT_URL)
    expect(request.method).toBe('POST')
    expect(request.headers.get('Authorization')).toBe(
      'Bearer firebase-id-token'
    )
    expect(JSON.parse(String(request.body))).toEqual({
      workspace_id: 'ws-a',
      resource: 'partner-node'
    })
  })

  it.for([
    {
      name: 'an HTTP refusal',
      respond: () => Response.json({ message: 'no' }, { status: 403 })
    },
    {
      name: 'a malformed body',
      respond: () => Response.json({ unexpected: true })
    },
    {
      name: 'a token for another workspace',
      respond: () => mintResponse('pn-other', { workspaceId: 'ws-b' })
    },
    {
      name: 'a token that has already expired',
      respond: () => mintResponse('pn-expired', { lifetimeMs: 0 })
    }
  ])('yields no token after $name and reports it', async ({ respond }) => {
    respondToFetch(MINT_URL, respond)
    const { source } = setup()

    await expect(source.tokenFor(target())).resolves.toBeUndefined()
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      surface: 'auth',
      errorType: 'failure_minting_partner_node_token',
      level: 'warning',
      tags: expect.any(Object)
    })
  })

  it('yields no token and sends nothing without an identity token', async () => {
    const { source } = setup()

    await expect(
      source.tokenFor(target({ idToken: async () => undefined }))
    ).resolves.toBeUndefined()
    expect(fetchRequests(MINT_URL)).toHaveLength(0)
  })

  it('mints once for concurrent callers', async () => {
    respondToFetch(MINT_URL, () => mintResponse('pn-1'))
    const { source } = setup()

    const tokens = await Promise.all([
      source.tokenFor(target()),
      source.tokenFor(target()),
      source.tokenFor(target())
    ])

    expect(tokens).toEqual(['pn-1', 'pn-1', 'pn-1'])
    expect(fetchRequests(MINT_URL)).toHaveLength(1)
  })

  it('reuses a token with comfortable life left and re-mints near expiry', async () => {
    let minted = 0
    respondToFetch(MINT_URL, () => mintResponse(`pn-${++minted}`))
    const { source, advance } = setup()

    await expect(source.tokenFor(target())).resolves.toBe('pn-1')
    advance(90 * MINUTE - PARTNER_NODE_REUSE_MIN_REMAINING_MS - MINUTE)
    await expect(source.tokenFor(target())).resolves.toBe('pn-1')
    advance(2 * MINUTE)
    await expect(source.tokenFor(target())).resolves.toBe('pn-2')
    expect(fetchRequests(MINT_URL)).toHaveLength(2)
  })

  it('mints per workspace without revoking the previous workspace', async () => {
    respondToFetch(MINT_URL, (_input, init) => {
      const { workspace_id } = JSON.parse(String(init?.body))
      return mintResponse(`pn-${workspace_id}`, { workspaceId: workspace_id })
    })
    const { source } = setup()

    await source.tokenFor(target({ workspaceId: 'ws-a' }))
    await expect(
      source.tokenFor(target({ workspaceId: 'ws-b' }))
    ).resolves.toBe('pn-ws-b')

    expect(fetchRequests(REVOKE_URL)).toHaveLength(0)
    await expect(
      source.tokenFor(target({ workspaceId: 'ws-a' }))
    ).resolves.toBe('pn-ws-a')
    expect(fetchRequests(MINT_URL)).toHaveLength(2)
  })

  it('revokes once per account with a held token and forgets every token', async () => {
    let minted = 0
    respondToFetch(MINT_URL, () => mintResponse(`pn-${++minted}`))
    respondToFetch(REVOKE_URL, () => new Response(null, { status: 204 }))
    const { source } = setup()
    await source.tokenFor(target())

    await source.revokeAll()

    const revokes = fetchRequests(REVOKE_URL)
    expect(revokes).toHaveLength(1)
    expect(revokes[0].method).toBe('POST')
    expect(revokes[0].headers.get('Authorization')).toBe('Bearer pn-1')
    await expect(source.tokenFor(target())).resolves.toBe('pn-2')
  })

  it('sends no revoke when nothing was minted', async () => {
    const { source } = setup()

    await source.revokeAll()

    expect(fetchRequests(REVOKE_URL)).toHaveLength(0)
  })

  it('revokes and drops a token whose mint lands after a revoke', async () => {
    let releaseMint!: () => void
    const mintHeld = new Promise<void>((resolve) => {
      releaseMint = resolve
    })
    respondToFetch(MINT_URL, async () => {
      await mintHeld
      return mintResponse('pn-late')
    })
    respondToFetch(REVOKE_URL, () => new Response(null, { status: 204 }))
    const { source } = setup()

    const pending = source.tokenFor(target())
    await source.revokeAll()
    releaseMint()

    await expect(pending).resolves.toBeUndefined()
    await vi.waitFor(() =>
      expect(
        fetchRequests(REVOKE_URL).map((r) => r.headers.get('Authorization'))
      ).toEqual(['Bearer pn-late'])
    )
  })

  it('reports a refused revoke without throwing', async () => {
    respondToFetch(MINT_URL, () => mintResponse('pn-1'))
    respondToFetch(REVOKE_URL, () => new Response(null, { status: 500 }))
    const { source } = setup()
    await source.tokenFor(target())

    await source.revokeAll()

    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      surface: 'auth',
      errorType: 'failure_revoking_partner_node_sessions',
      level: 'warning',
      tags: { status: 500 }
    })
  })
})
