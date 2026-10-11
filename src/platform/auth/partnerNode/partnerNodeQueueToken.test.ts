import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { DesktopHostAuthBridge } from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import {
  startDesktopHostSession,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'
import { queueAuthToken } from '@/platform/auth/partnerNode/partnerNodeQueueToken'
import { partnerNodeTokens } from '@/platform/auth/partnerNode/partnerNodeTokens'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  }
}))

const MINT_URL = /\/api\/auth\/token$/
const WORKSPACE_TOKEN = 'workspace-token'

function signInFirebase() {
  useAuthStore().currentUser = fromPartial<User>({
    uid: 'user-a',
    getIdToken: async () => 'firebase-id-token'
  })
}

function respondWithPartnerNodeToken() {
  respondToFetch(MINT_URL, () =>
    Response.json({
      token: 'partner-node-token',
      expires_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
      workspace: { id: 'ws-a', name: 'Team', type: 'team' },
      role: 'owner',
      permissions: []
    })
  )
}

beforeEach(() => {
  stubFirebaseAuthHarness()
  distribution.isCloud = false
  respondToFetch(/\/api\/auth\/token\/revoke$/, () => new Response(null))
})

afterEach(async () => {
  stopDesktopHostSession()
  await partnerNodeTokens.revokeAll()
})

describe('queueAuthToken', () => {
  it('keeps the workspace token and mints nothing with the flag off', async () => {
    signInFirebase()
    respondWithPartnerNodeToken()

    await expect(queueAuthToken(WORKSPACE_TOKEN, 'ws-a')).resolves.toBe(
      WORKSPACE_TOKEN
    )
    expect(fetchRequests(MINT_URL)).toHaveLength(0)
  })

  it('carries the partner-node token with the flag on', async () => {
    vi.mocked(useFeatureFlags().flags).partnerNodeTokenEnabled = true
    signInFirebase()
    respondWithPartnerNodeToken()

    await expect(queueAuthToken(WORKSPACE_TOKEN, 'ws-a')).resolves.toBe(
      'partner-node-token'
    )
  })

  it('falls back to the workspace token when the mint fails', async () => {
    vi.mocked(useFeatureFlags().flags).partnerNodeTokenEnabled = true
    signInFirebase()
    respondToFetch(MINT_URL, () => new Response(null, { status: 503 }))

    await expect(queueAuthToken(WORKSPACE_TOKEN, 'ws-a')).resolves.toBe(
      WORKSPACE_TOKEN
    )
  })

  it.for([
    { name: 'without a workspace token', token: undefined, workspace: 'ws-a' },
    { name: 'without a workspace', token: WORKSPACE_TOKEN, workspace: null }
  ])('passes the input through $name', async ({ token, workspace }) => {
    vi.mocked(useFeatureFlags().flags).partnerNodeTokenEnabled = true
    signInFirebase()

    await expect(queueAuthToken(token, workspace)).resolves.toBe(token)
    expect(fetchRequests(MINT_URL)).toHaveLength(0)
  })

  it('keeps the workspace token on Cloud', async () => {
    vi.mocked(useFeatureFlags().flags).partnerNodeTokenEnabled = true
    distribution.isCloud = true
    signInFirebase()

    await expect(queueAuthToken(WORKSPACE_TOKEN, 'ws-a')).resolves.toBe(
      WORKSPACE_TOKEN
    )
    expect(fetchRequests(MINT_URL)).toHaveLength(0)
  })

  it('keeps the Desktop host token while Desktop owns the session', async () => {
    vi.mocked(useFeatureFlags().flags).partnerNodeTokenEnabled = true
    const bridge = fromPartial<DesktopHostAuthBridge>({
      getState: async () => ({
        status: 'signed_in',
        userId: 'user-a',
        email: 'a@example.com',
        workspaceId: 'ws-a'
      }),
      onChanged: () => () => {}
    })
    await startDesktopHostSession(bridge)

    await expect(queueAuthToken('host-token', 'ws-a')).resolves.toBe(
      'host-token'
    )
    expect(fetchRequests(MINT_URL)).toHaveLength(0)
  })
})
