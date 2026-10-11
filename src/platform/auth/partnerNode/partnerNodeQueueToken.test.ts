import { fetchRequests, respondToFetch } from '@comfyorg/test-utils/fetch'
import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { signOut } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type {
  DesktopHostAuthBridge,
  DesktopHostAuthState
} from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import {
  startDesktopHostSession,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'
import { queueAuthToken } from '@/platform/auth/partnerNode/partnerNodeQueueToken'
import { partnerNodeTokens } from '@/platform/auth/partnerNode/partnerNodeTokens'
import { reportError } from '@/platform/telemetry/reportError'
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
const REVOKE_URL = /\/api\/auth\/token\/revoke$/
const WORKSPACE_TOKEN = 'workspace-token'

function signInFirebase(uid = 'user-a', idToken = 'firebase-id-token') {
  useAuthStore().currentUser = fromPartial<User>({
    uid,
    getIdToken: async () => idToken
  })
}

const revokeBearers = () =>
  fetchRequests(REVOKE_URL).map((r) => r.headers.get('Authorization'))

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
  respondToFetch(REVOKE_URL, () => new Response(null))
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

  describe('with a host session', () => {
    const signedInAs = (
      userId: string,
      workspaceId = 'ws-a'
    ): DesktopHostAuthState => ({ status: 'signed_in', userId, workspaceId })

    async function startHostSession(state: DesktopHostAuthState) {
      const listeners = new Set<(next: DesktopHostAuthState) => void>()
      const bridge = fromPartial<DesktopHostAuthBridge>({
        getState: async () => state,
        signOut: vi.fn(async () => ({ status: 'signed_out' }) as const),
        getWorkspaceToken: async (workspaceId: string) =>
          state.status === 'signed_in' && state.workspaceId === workspaceId
            ? 'host-oauth-token'
            : null,
        onChanged: (listener: (next: DesktopHostAuthState) => void) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      })
      await startDesktopHostSession(bridge)
      return {
        bridge,
        push: async (next: DesktopHostAuthState) => {
          listeners.forEach((listener) => listener(next))
          await nextTick()
        }
      }
    }

    beforeEach(() => {
      vi.mocked(useFeatureFlags().flags).partnerNodeTokenEnabled = true
      useAuthStore()
    })

    it('mints with the host OAuth access token for the workspace', async () => {
      await startHostSession(signedInAs('host-a'))
      respondWithPartnerNodeToken()

      await expect(queueAuthToken('host-token', 'ws-a')).resolves.toBe(
        'partner-node-token'
      )

      const [mint] = fetchRequests(MINT_URL)
      expect(mint.headers.get('Authorization')).toBe('Bearer host-oauth-token')
      expect(JSON.parse(String(mint.body))).toEqual({
        workspace_id: 'ws-a',
        resource: 'partner-node'
      })
    })

    it.for([
      {
        name: 'the mint fails',
        sessionWorkspace: 'ws-a',
        respond: () => new Response(null, { status: 403 }),
        mints: 1
      },
      {
        name: 'the minted token is for another workspace',
        sessionWorkspace: 'ws-a',
        respond: () =>
          Response.json({
            token: 'partner-node-token',
            expires_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
            workspace: { id: 'ws-b', name: 'Other', type: 'team' },
            role: 'owner',
            permissions: []
          }),
        mints: 1
      },
      {
        name: 'the host session is on another workspace',
        sessionWorkspace: 'ws-b',
        respond: () => new Response(null, { status: 500 }),
        mints: 0
      }
    ])(
      'keeps the host token when $name',
      async ({ sessionWorkspace, respond, mints }) => {
        await startHostSession(signedInAs('host-a', sessionWorkspace))
        respondToFetch(MINT_URL, respond)

        await expect(queueAuthToken('host-token', 'ws-a')).resolves.toBe(
          'host-token'
        )
        expect(fetchRequests(MINT_URL)).toHaveLength(mints)
      }
    )

    it('keeps the host token and mints nothing with the flag off', async () => {
      vi.mocked(useFeatureFlags().flags).partnerNodeTokenEnabled = false
      await startHostSession(signedInAs('host-a'))
      respondWithPartnerNodeToken()

      await expect(queueAuthToken('host-token', 'ws-a')).resolves.toBe(
        'host-token'
      )
      expect(fetchRequests(MINT_URL)).toHaveLength(0)
    })

    it.for([
      { name: 'host sign-out', next: { status: 'signed_out' } as const },
      { name: 'a host account switch', next: signedInAs('host-b') }
    ])('revokes the minted session on $name', async ({ next }) => {
      const host = await startHostSession(signedInAs('host-a'))
      respondWithPartnerNodeToken()
      await queueAuthToken('host-token', 'ws-a')

      await host.push(next)

      const revokes = fetchRequests(REVOKE_URL)
      expect(revokes).toHaveLength(1)
      expect(revokes[0].headers.get('Authorization')).toBe(
        'Bearer partner-node-token'
      )
    })

    it('revokes with the host OAuth access token before signing the host out', async () => {
      const { bridge } = await startHostSession(signedInAs('host-a'))
      const revokesAtSignOut: number[] = []
      vi.mocked(bridge.signOut).mockImplementation(async () => {
        revokesAtSignOut.push(fetchRequests(REVOKE_URL).length)
        return { status: 'signed_out' }
      })

      await useAuthStore().logout()

      expect(revokeBearers()).toEqual(['Bearer host-oauth-token'])
      expect(revokesAtSignOut).toEqual([1])
    })
  })
})

describe('sign-out', () => {
  beforeEach(() => {
    vi.mocked(signOut).mockResolvedValue(undefined)
  })

  it('revokes with the Firebase ID token before signing out, with nothing minted in this page load', async () => {
    vi.mocked(useFeatureFlags().flags).partnerNodeTokenEnabled = true
    signInFirebase()
    const revokesAtSignOut: number[] = []
    vi.mocked(signOut).mockImplementation(async () => {
      revokesAtSignOut.push(fetchRequests(REVOKE_URL).length)
    })

    await useAuthStore().logout()

    expect(revokeBearers()).toEqual(['Bearer firebase-id-token'])
    expect(revokesAtSignOut).toEqual([1])
  })

  it('revokes only the previous account when switching accounts', async () => {
    vi.mocked(useFeatureFlags().flags).partnerNodeTokenEnabled = true
    signInFirebase()
    respondWithPartnerNodeToken()
    await queueAuthToken(WORKSPACE_TOKEN, 'ws-a')

    await useAuthStore().logout()
    signInFirebase('user-b', 'firebase-id-token-b')
    await queueAuthToken(WORKSPACE_TOKEN, 'ws-a')

    expect(revokeBearers()).toEqual(['Bearer firebase-id-token'])
    expect(fetchRequests(MINT_URL)).toHaveLength(2)
  })

  it('does not revoke with the previous account credential when the account changes mid-lookup', async () => {
    vi.mocked(useFeatureFlags().flags).partnerNodeTokenEnabled = true
    useAuthStore().currentUser = fromPartial<User>({
      uid: 'user-a',
      getIdToken: async () => {
        signInFirebase('user-b', 'firebase-id-token-b')
        return 'firebase-id-token'
      }
    })

    await useAuthStore().logout()

    expect(revokeBearers()).not.toContain('Bearer firebase-id-token')
  })

  it('revokes nothing on a workspace switch', async () => {
    vi.mocked(useFeatureFlags().flags).partnerNodeTokenEnabled = true
    signInFirebase()
    respondToFetch(MINT_URL, (_input, init) => {
      const { workspace_id } = JSON.parse(String(init?.body))
      return Response.json({
        token: `partner-node-${workspace_id}`,
        expires_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        workspace: { id: workspace_id, name: 'Team', type: 'team' },
        role: 'owner',
        permissions: []
      })
    })

    await queueAuthToken(WORKSPACE_TOKEN, 'ws-a')
    await queueAuthToken(WORKSPACE_TOKEN, 'ws-b')

    expect(fetchRequests(REVOKE_URL)).toHaveLength(0)
  })

  it('sends nothing with the flag off', async () => {
    signInFirebase()

    await useAuthStore().logout()

    expect(fetchRequests(REVOKE_URL)).toHaveLength(0)
  })

  it.for([
    {
      name: 'refused',
      respond: () => new Response(null, { status: 500 })
    },
    {
      name: 'unreachable',
      respond: () => Promise.reject(new TypeError('offline'))
    }
  ])('signs out when the revoke is $name', async ({ respond }) => {
    vi.mocked(useFeatureFlags().flags).partnerNodeTokenEnabled = true
    signInFirebase()
    respondToFetch(REVOKE_URL, respond)

    await expect(useAuthStore().logout()).resolves.toBeUndefined()

    expect(signOut).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce())
  })
})
