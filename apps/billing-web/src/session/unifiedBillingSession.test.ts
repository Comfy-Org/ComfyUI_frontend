import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import type { FakeWebSessionState } from '@comfyorg/account-core/testing'
import {
  createFakeWebSessionEndpoint,
  fakeWebSessionUser
} from '@comfyorg/account-core/testing'
import type { User } from 'firebase/auth'

import { createWebSessionBillingClient } from '@/session/billingWebClient'
import { createUnifiedBillingSession } from '@/session/unifiedBillingSession'

const API = 'https://testcloud.comfy.org/api'

interface SentRequest {
  readonly method: string
  readonly path: string
  readonly credentials?: RequestCredentials
  readonly headers: Readonly<Record<string, string>>
}

const LIVE: FakeWebSessionState = { kind: 'live', user: fakeWebSessionUser() }

function firebaseUser(uid: string): User {
  const user: Pick<User, 'uid' | 'getIdToken'> = {
    uid,
    getIdToken: async () => `proof-${uid}`
  }
  return user as User
}

function rememberedFirebase(remembered: User | null) {
  const signOut = vi.fn(async () => undefined)
  const identity: Pick<FirebaseIdentity, 'onUserChanged' | 'signOut'> = {
    onUserChanged: (callback) => {
      queueMicrotask(() => callback(remembered))
      return () => undefined
    },
    signOut
  }
  return {
    signOut,
    loadFirebase: vi.fn(async () => identity as FirebaseIdentity)
  }
}

function workspaceRoute(workspace: Response | (() => Response)) {
  return (): Response =>
    typeof workspace === 'function' ? workspace() : workspace.clone()
}

const TEAM = new Response(
  JSON.stringify({
    auth_method: 'session',
    id: 'ws-team',
    name: 'Team',
    type: 'team',
    role: 'member'
  })
)

function setup({
  state = LIVE,
  remembered = null as User | null,
  workspace = workspaceRoute(TEAM),
  workspaceId = undefined as string | undefined
} = {}) {
  const endpoint = createFakeWebSessionEndpoint({ state })
  const sent: SentRequest[] = []
  const fetchImpl = vi.fn<typeof fetch>(async (input, init = {}) => {
    const url = new URL(String(input))
    sent.push({
      method: init.method ?? 'GET',
      path: url.pathname,
      credentials: init.credentials,
      headers: Object.fromEntries(
        [...new Headers(init.headers)].map(([k, v]) => [k.toLowerCase(), v])
      )
    })
    if (url.pathname === '/api/workspaces/current') return workspace()
    if (url.pathname.startsWith('/api/billing/')) {
      return new Response(JSON.stringify({}))
    }
    return endpoint.fetch(input, init)
  })
  const firebase = rememberedFirebase(remembered)
  const session = createUnifiedBillingSession({
    apiBaseUrl: API,
    fetchImpl,
    loadFirebase: firebase.loadFirebase,
    workspaceId: () => workspaceId
  })
  const paths = () => sent.map((r) => `${r.method} ${r.path}`)
  return { session, sent, firebase, paths }
}

describe('billing-web on the shared web session', () => {
  it('signs in from a live session without touching Firebase (SS1)', async () => {
    const { session, firebase, sent, paths } = setup({
      workspaceId: 'ws-team'
    })

    await expect(session.settledPhase()).resolves.toBe('authenticated')
    await expect(session.signInPort.loadIdentity()).resolves.toBeUndefined()

    expect(firebase.loadFirebase).not.toHaveBeenCalled()
    expect(paths()).toEqual([
      'GET /api/auth/session',
      'GET /api/workspaces/current'
    ])
    expect(sent[1]).toMatchObject({
      credentials: 'include',
      headers: {
        'x-comfy-client': expect.stringMatching(/^@comfyorg\/account-core\//),
        'x-comfy-workspace-id': 'ws-team'
      }
    })
    expect(sent[1]?.headers).not.toHaveProperty('authorization')
  })

  it("shows the session's account even when this origin remembers another (SS3)", async () => {
    const { session, firebase } = setup({
      remembered: firebaseUser('someone-else')
    })

    await session.settledPhase()

    expect(session.billedScope.value).toEqual({
      uid: 'user-1',
      workspace: expect.objectContaining({ id: 'ws-team', name: 'Team' })
    })
    expect(firebase.loadFirebase).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'no session, nothing remembered: sign-in',
      state: { kind: 'dead', code: 'no_session' },
      remembered: null,
      phase: 'signed-out'
    },
    {
      name: 'expired session, nothing remembered: sign-in',
      state: { kind: 'dead', code: 'session_expired' },
      remembered: null,
      phase: 'signed-out'
    },
    {
      name: 'no session, a remembered login: silent restore',
      state: { kind: 'dead', code: 'no_session' },
      remembered: 'user-1',
      phase: 'authenticated'
    },
    {
      name: 'revoked session: sign-in',
      state: { kind: 'dead', code: 'session_revoked' },
      remembered: 'user-1',
      phase: 'signed-out'
    }
  ] as const)(
    '$name, consulting Firebase only then',
    async ({ state, remembered, phase }) => {
      const { session, firebase } = setup({
        state,
        remembered: remembered === null ? null : firebaseUser(remembered)
      })

      await expect(session.settledPhase()).resolves.toBe(phase)

      expect(firebase.loadFirebase).toHaveBeenCalled()
    }
  )

  it('signs a revoked login out on this origin too', async () => {
    const { session, firebase } = setup({
      state: { kind: 'dead', code: 'session_revoked' },
      remembered: firebaseUser('user-1')
    })

    await session.settledPhase()

    await vi.waitFor(() => expect(firebase.signOut).toHaveBeenCalledOnce())
  })

  it('creates the shared session from an interactive sign-in', async () => {
    const { session, sent } = setup({
      state: { kind: 'dead', code: 'no_session' }
    })
    await expect(session.settledPhase()).resolves.toBe('signed-out')
    await expect(session.signInPort.loadIdentity()).resolves.toBeDefined()

    await expect(
      session.signInPort.establish(firebaseUser('user-1'))
    ).resolves.toBe(true)

    expect(sent.find((r) => r.method === 'POST')?.headers).toMatchObject({
      authorization: 'Bearer proof-user-1'
    })
    expect(session.billedScope.value?.workspace.id).toBe('ws-team')
  })

  it.for([
    {
      name: 'a workspace the account is not in',
      status: 403,
      code: 'workspace_access_denied',
      failure: 'ACCESS_DENIED'
    },
    {
      name: 'a malformed workspace id',
      status: 400,
      code: 'workspace_id_invalid',
      failure: 'WORKSPACE_NOT_FOUND'
    }
  ])(
    '$name shows its refusal and never the personal workspace (SO4)',
    async ({ status, code, failure }) => {
      const { session, firebase } = setup({
        workspace: () =>
          new Response(JSON.stringify({ code, message: code }), { status })
      })

      await expect(session.settledPhase()).resolves.toBe('error')

      expect(session.signInPort.failureCode.value).toBe(failure)
      expect(session.billedScope.value).toBeUndefined()
      await expect(session.signInPort.loadIdentity()).resolves.toBeUndefined()
      expect(firebase.loadFirebase).not.toHaveBeenCalled()
    }
  )

  it.for([
    { entry: 'ws-team', header: 'ws-team' },
    { entry: undefined, header: 'ws-team' }
  ])(
    'sends the resolved workspace on every billing request (entry $entry)',
    async ({ entry, header }) => {
      const { session, sent } = setup({ workspaceId: entry })
      await session.settledPhase()

      await createWebSessionBillingClient(session).status.read()

      const resolve = sent.find((r) => r.path === '/api/workspaces/current')
      expect(resolve?.headers['x-comfy-workspace-id']).toBe(entry)
      const billing = sent.at(-1)
      expect(billing?.path).toBe('/api/billing/status')
      expect(billing).toMatchObject({
        credentials: 'include',
        headers: { 'x-comfy-workspace-id': header }
      })
      expect(billing?.headers).not.toHaveProperty('authorization')
    }
  )
})
