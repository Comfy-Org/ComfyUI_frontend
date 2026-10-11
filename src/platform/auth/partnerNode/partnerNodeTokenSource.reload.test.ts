import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { describe, expect, it, vi } from 'vitest'

import { createPartnerNodeTokenSource } from '@/platform/auth/partnerNode/partnerNodeTokenSource'
import type { PartnerNodeTokenTarget } from '@/platform/auth/partnerNode/partnerNodeTokenSource'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const MINT_URL = 'https://cloud.test/api/auth/token'
const REVOKE_URL = 'https://cloud.test/api/auth/token/revoke'
const NOW = Date.parse('2026-10-11T00:00:00Z')

function mintResponse(token: string) {
  return Response.json({
    token,
    expires_at: new Date(NOW + 90 * 60 * 1000).toISOString(),
    workspace: { id: 'ws-a', name: 'Team', type: 'team' },
    role: 'owner',
    permissions: []
  })
}

const target: PartnerNodeTokenTarget = {
  ownerUid: 'user-a',
  workspaceId: 'ws-a',
  credential: async () => 'firebase-id-token'
}

const pageLoad = () =>
  createPartnerNodeTokenSource({
    apiUrl: (route) => `https://cloud.test/api${route}`,
    now: () => NOW
  })

describe('sign-out after a reload, a new tab or a crash', () => {
  it('revokes the login with the sign-in credential the new page load holds', async () => {
    respondToFetch(MINT_URL, () => mintResponse('pn-queued'))
    respondToFetch(REVOKE_URL, () => new Response(null, { status: 204 }))
    const beforeReload = pageLoad()
    await expect(beforeReload.tokenFor(target)).resolves.toBe('pn-queued')

    const afterReload = pageLoad()
    await afterReload.revokeLogin('firebase-id-token')

    expect(
      fetchRequests(REVOKE_URL).map((r) => r.headers.get('Authorization'))
    ).toEqual(['Bearer firebase-id-token'])
  })
})
