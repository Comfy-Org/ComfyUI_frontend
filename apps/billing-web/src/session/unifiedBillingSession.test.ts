import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import type { FakeWebSessionState } from '@comfyorg/account-core/testing'
import {
  createFakeWebSessionEndpoint,
  fakeWebSessionUser
} from '@comfyorg/account-core/testing'
import type { User } from 'firebase/auth'

import { createUnifiedBillingSession } from '@/session/unifiedBillingSession'

const API = 'https://testcloud.comfy.org/api'

interface SentRequest {
  readonly method: string
  readonly path: string
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

function setup({ state = LIVE, remembered = null as User | null } = {}) {
  const endpoint = createFakeWebSessionEndpoint({ state })
  const sent: SentRequest[] = []
  const fetchImpl = vi.fn<typeof fetch>(async (input, init = {}) => {
    sent.push({
      method: init.method ?? 'GET',
      path: new URL(String(input)).pathname,
      headers: Object.fromEntries(
        [...new Headers(init.headers)].map(([k, v]) => [k.toLowerCase(), v])
      )
    })
    return endpoint.fetch(input, init)
  })
  const firebase = rememberedFirebase(remembered)
  const session = createUnifiedBillingSession({
    apiBaseUrl: API,
    fetchImpl,
    loadFirebase: firebase.loadFirebase
  })
  return { session, sent, firebase }
}

describe('billing-web on the shared web session', () => {
  it('signs in from a live session without touching Firebase', async () => {
    const { session, firebase, sent } = setup()

    await expect(session.settledPhase()).resolves.toBe('authenticated')
    await expect(session.signInPort.loadIdentity()).resolves.toBeUndefined()

    expect(firebase.loadFirebase).not.toHaveBeenCalled()
    expect(sent.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /api/auth/session'
    ])
  })

  it("follows the session's account even when this origin remembers another (SS3)", async () => {
    const { session, firebase } = setup({
      remembered: firebaseUser('someone-else')
    })

    await session.settledPhase()

    expect(session.signInPort.user.value).toMatchObject({ id: 'user-1' })
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
  })
})
