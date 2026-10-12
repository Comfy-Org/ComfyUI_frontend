import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import type { FakeWebSessionState } from '@comfyorg/account-core/testing'
import {
  createFakeWebSessionEndpoint,
  fakeWebSessionUser
} from '@comfyorg/account-core/testing'
import type { User } from 'firebase/auth'

import { createWebSessionBillingClient } from '@/session/billingWebClient'
import { createUnifiedBillingSession } from '@/session/unifiedBillingSession'
import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'

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

function rememberedFirebase(initial: User | null) {
  let remembered = initial
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
    remember: (user: User) => {
      remembered = user
    },
    loadFirebase: vi.fn(async () => identity as FirebaseIdentity)
  }
}

function unsettledAfter<T>(settling: Promise<T>, ms: number) {
  return Promise.race([
    settling,
    new Promise<'unsettled'>((resolve) =>
      setTimeout(() => resolve('unsettled'), ms)
    )
  ])
}

function workspaceRoute(workspace: Response | (() => Response)) {
  return (): Response | Promise<Response> =>
    typeof workspace === 'function' ? workspace() : workspace.clone()
}

function pendingResponse() {
  let resolve: (response: Response) => void = () => {}
  const promise = new Promise<Response>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
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

function trackedWebSessionEvents() {
  const track = vi
    .spyOn(billingWebTelemetry, 'trackWebSessionEvent')
    .mockImplementation(() => undefined)
  return () => track.mock.calls.map(([event]) => event)
}

function bootstrapEvent(outcome: string) {
  return {
    name: 'session_bootstrap',
    properties: { outcome, origin: globalThis.location.origin }
  }
}

function setup({
  state = LIVE,
  remembered = null as User | null,
  workspace = workspaceRoute(TEAM),
  workspaceId = undefined as string | undefined,
  creationOutages = 0,
  creationRefusal = undefined as object | undefined
} = {}) {
  const endpoint = createFakeWebSessionEndpoint({ state })
  const outage = { remaining: creationOutages }
  const sent: SentRequest[] = []
  function refuseCreation(): Response | undefined {
    if (outage.remaining > 0) {
      outage.remaining -= 1
      return new Response(JSON.stringify({ code: 'unavailable' }), {
        status: 503
      })
    }
    return creationRefusal
      ? new Response(JSON.stringify(creationRefusal), { status: 403 })
      : undefined
  }
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
    if (init.method === 'POST' && url.pathname === '/api/auth/session') {
      const refused = refuseCreation()
      if (refused) return refused
    }
    if (url.pathname.startsWith('/api/billing/')) {
      return new Response(JSON.stringify({}))
    }
    return endpoint.fetch(input, init)
  })
  const firebase = rememberedFirebase(remembered)
  const entry = { workspaceId }
  const session = createUnifiedBillingSession({
    apiBaseUrl: API,
    fetchImpl,
    loadFirebase: firebase.loadFirebase,
    workspaceId: () => entry.workspaceId
  })
  const paths = () => sent.map((r) => `${r.method} ${r.path}`)
  return { session, sent, firebase, paths, entry, outage }
}

describe('billing-web on the shared web session', () => {
  it('signs in from a live session without touching Firebase (SS1)', async () => {
    const tracked = trackedWebSessionEvents()
    const { session, firebase, sent, paths } = setup({
      workspaceId: 'ws-team'
    })

    await expect(session.settledPhase()).resolves.toBe('authenticated')
    await expect(session.signInPort.loadIdentity()).resolves.toBeUndefined()

    expect(firebase.loadFirebase).not.toHaveBeenCalled()
    expect(tracked()).toEqual([bootstrapEvent('signed_in')])
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
      phase: 'signed-out',
      outcome: 'signed_out'
    },
    {
      name: 'expired session, nothing remembered: sign-in',
      state: { kind: 'dead', code: 'session_expired' },
      remembered: null,
      phase: 'signed-out',
      outcome: 'signed_out'
    },
    {
      name: 'no session, a remembered login: silent restore',
      state: { kind: 'dead', code: 'no_session' },
      remembered: 'user-1',
      phase: 'authenticated',
      outcome: 'restored'
    },
    {
      name: 'revoked session: sign-in',
      state: { kind: 'dead', code: 'session_revoked' },
      remembered: 'user-1',
      phase: 'signed-out',
      outcome: 'revoked'
    }
  ] as const)(
    '$name, consulting Firebase only then',
    async ({ state, remembered, phase, outcome }) => {
      const tracked = trackedWebSessionEvents()
      const { session, firebase } = setup({
        state,
        remembered: remembered === null ? null : firebaseUser(remembered)
      })

      await expect(session.settledPhase()).resolves.toBe(phase)

      expect(firebase.loadFirebase).toHaveBeenCalled()
      expect(tracked()).toEqual([bootstrapEvent(outcome)])
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
    ).resolves.toEqual({ status: 'ok' })

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

      expect(session.signInPort.failure.value?.code).toBe(failure)
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

  it.for([
    {
      name: 'a rebind to another workspace exposes none while it resolves',
      from: 'ws-team',
      to: 'ws-other',
      during: undefined
    },
    {
      name: 'a re-resolve of the same personal binding keeps its workspace',
      from: undefined,
      to: undefined,
      during: 'ws-team'
    }
  ])('$name', async ({ from, to, during }) => {
    const answers: (() => Response | Promise<Response>)[] = [
      () => TEAM.clone(),
      () => new Promise<Response>(() => {})
    ]
    const { session, entry } = setup({
      workspaceId: from,
      workspace: () => answers.shift()?.() ?? TEAM.clone()
    })
    await session.settledPhase()

    entry.workspaceId = to
    void session.resolveWorkspace()

    expect(session.scopeSource.getScope()?.workspaceId).toBe(during)
    expect(session.billedScope.value?.workspace.id).toBe(during)
  })

  it.for([
    {
      name: 'refused',
      answerB: () =>
        new Response(
          JSON.stringify({
            code: 'workspace_access_denied',
            message: 'denied'
          }),
          { status: 403 }
        ),
      established: { status: 'error', code: 'ACCESS_DENIED' },
      scope: undefined
    },
    {
      name: 'resolved',
      answerB: () =>
        new Response(
          JSON.stringify({
            auth_method: 'session',
            id: 'ws-b',
            name: 'B',
            type: 'team',
            role: 'owner'
          })
        ),
      established: { status: 'ok' },
      scope: 'ws-b'
    }
  ])(
    'a lookup superseded by binding B reports B once B is $name',
    async ({ answerB, established, scope }) => {
      const answerA = pendingResponse()
      const lookupB = pendingResponse()
      const answers: (() => Response | Promise<Response>)[] = [
        () => TEAM.clone(),
        () => answerA.promise,
        () => lookupB.promise
      ]
      const { session, entry } = setup({
        workspace: () => answers.shift()?.() ?? TEAM.clone()
      })
      await session.settledPhase()

      entry.workspaceId = 'ws-a'
      const outcome = vi.fn()
      void session.signInPort.establish().then(outcome)
      entry.workspaceId = 'ws-b'
      void session.resolveWorkspace()
      answerA.resolve(TEAM.clone())
      await new Promise((resolve) => setTimeout(resolve))

      expect(outcome).not.toHaveBeenCalled()
      lookupB.resolve(answerB())
      await vi.waitFor(() => expect(outcome).toHaveBeenCalledWith(established))
      expect(session.scopeSource.getScope()?.workspaceId).toBe(scope)
    }
  )

  it.for([
    {
      name: 'naming its organization',
      body: { organization_id: 'org_acme' },
      failure: { code: 'SSO_REQUIRED', organizationId: 'org_acme' }
    },
    {
      name: 'without an organization',
      body: {},
      failure: { code: 'SSO_REQUIRED' }
    }
  ])(
    'an account its SSO organization holds is refused as SSO_REQUIRED, $name',
    async ({ body, failure }) => {
      const { session } = setup({
        state: { kind: 'dead', code: 'no_session' },
        creationRefusal: { code: 'sso_required', message: 'use SSO', ...body }
      })
      await expect(session.settledPhase()).resolves.toBe('signed-out')
      await session.signInPort.loadIdentity()

      await expect(
        session.signInPort.establish(firebaseUser('user-1'))
      ).resolves.toEqual({ status: 'error', code: 'SSO_REQUIRED' })

      expect(session.signInPort.failure.value).toEqual(failure)
    }
  )

  describe('when creating the shared session is unavailable', () => {
    it('Try again creates it for the Firebase user who just signed in', async () => {
      const { session, firebase, paths } = setup({
        state: { kind: 'dead', code: 'no_session' },
        creationOutages: 1
      })
      await expect(session.settledPhase()).resolves.toBe('signed-out')
      await session.signInPort.loadIdentity()
      const user = firebaseUser('user-1')
      firebase.remember(user)

      await expect(session.signInPort.establish(user)).resolves.toEqual({
        status: 'error',
        code: 'TOKEN_EXCHANGE_FAILED'
      })
      await expect(session.signInPort.establish()).resolves.toEqual({
        status: 'ok'
      })

      expect(
        paths().filter((path) => path === 'POST /api/auth/session')
      ).toHaveLength(2)
      expect(session.billedScope.value?.workspace.id).toBe('ws-team')
    })

    it('settles to sign-in for a remembered login, and Try again restores it once the endpoint answers', async () => {
      const { session, outage } = setup({
        state: { kind: 'dead', code: 'no_session' },
        remembered: firebaseUser('user-1'),
        creationOutages: Number.POSITIVE_INFINITY
      })

      await expect(unsettledAfter(session.settledPhase(), 100)).resolves.toBe(
        'signed-out'
      )

      outage.remaining = 0
      await expect(session.signInPort.establish()).resolves.toEqual({
        status: 'ok'
      })
      expect(session.billedScope.value?.workspace.id).toBe('ws-team')
    })

    it('Try again without any Firebase user asks for sign-in without a request', async () => {
      const { session, sent } = setup({
        state: { kind: 'dead', code: 'no_session' }
      })
      await session.settledPhase()
      const before = sent.length

      await expect(session.signInPort.establish()).resolves.toEqual({
        status: 'error',
        code: 'NOT_AUTHENTICATED'
      })
      expect(sent).toHaveLength(before)
    })
  })
})
