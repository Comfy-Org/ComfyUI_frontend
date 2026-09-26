import { describe, expect, it, vi } from 'vitest'

import type { FakeWebSessionEndpoint, FakeWebSessionState } from '../testing.js'
import { createFakeWebSessionEndpoint, fakeWebSessionUser } from '../testing.js'
import type {
  CrossTabRefreshPort,
  WebSession,
  WebSessionResult
} from './sessionContracts.js'
import type {
  RememberedLogin,
  ScheduleRetry,
  VisibilityPort,
  WebSessionIdentityOptions,
  WebSessionIdentityState,
  WebSessionIdentityTransition,
  WebSessionSharedMessage
} from './webSessionIdentity.js'
import {
  createWebSessionIdentity,
  transitionWebSessionIdentity
} from './webSessionIdentity.js'

const API = 'https://cloud.example/api'
const ORIGIN = 'https://www.comfy.example'
const HEARTBEAT_MS = 10 * 60 * 1000
const USER_1 = fakeWebSessionUser({ id: 'user-1' })
const USER_2 = fakeWebSessionUser({ id: 'user-2', email: 'user-2@example.com' })

type AccountChange = Parameters<
  NonNullable<WebSessionIdentityOptions['onAccountChanged']>
>[0]

function createFakeScheduler() {
  const pending: { run: () => void; delayMs: number }[] = []
  const schedule: ScheduleRetry = (run, delayMs) => {
    const timer = { run, delayMs }
    pending.push(timer)
    return () => {
      const index = pending.indexOf(timer)
      if (index !== -1) pending.splice(index, 1)
    }
  }
  return {
    schedule,
    delays: () => pending.map(({ delayMs }) => delayMs),
    fire: (delayMs: number) => {
      const timer = pending.find((candidate) => candidate.delayMs === delayMs)
      if (!timer) throw new Error(`no timer armed for ${delayMs}ms`)
      pending.splice(pending.indexOf(timer), 1)
      timer.run()
    }
  }
}

function createFakeVisibility(initial: boolean) {
  const listeners = new Set<(visible: boolean) => void>()
  let visible = initial
  const port: VisibilityPort = {
    isVisible: () => visible,
    onChange: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
  return {
    port,
    set: (next: boolean) => {
      visible = next
      listeners.forEach((listener) => listener(next))
    }
  }
}

/** One site's Web Locks + BroadcastChannel: the first requester leads. */
function createFakeSiteBus() {
  const waiters: { onAcquired: () => void }[] = []
  const subscribers: { tab: object; callback: (message: unknown) => void }[] =
    []
  return (): CrossTabRefreshPort<WebSessionSharedMessage> => {
    const tab = {}
    return {
      requestLeadership: (_key, onAcquired) => {
        const waiter = { onAcquired }
        waiters.push(waiter)
        if (waiters.length === 1) onAcquired()
        return () => {
          const index = waiters.indexOf(waiter)
          if (index === -1) return
          waiters.splice(index, 1)
          if (index === 0) waiters[0]?.onAcquired()
        }
      },
      publishCredential: (_key, message) => {
        subscribers
          .filter((subscriber) => subscriber.tab !== tab)
          .forEach(({ callback }) => callback(structuredClone(message)))
      },
      onCredential: (_key, callback) => {
        const subscriber = { tab, callback }
        subscribers.push(subscriber)
        return () => {
          subscribers.splice(subscribers.indexOf(subscriber), 1)
        }
      }
    }
  }
}

function fakeRememberedLogin(userId: string | null) {
  return {
    currentUserId: vi.fn(async () => userId),
    getProof: vi.fn(async () => 'remembered-proof'),
    signOutLocally: vi.fn(async () => undefined)
  } satisfies RememberedLogin
}

function openTab({
  endpoint,
  site,
  visible = true,
  remembered = 'user-1',
  fetchImpl = endpoint.fetch
}: {
  endpoint: FakeWebSessionEndpoint
  site?: () => CrossTabRefreshPort<WebSessionSharedMessage>
  visible?: boolean
  remembered?: string | null
  fetchImpl?: typeof fetch
}) {
  const scheduler = createFakeScheduler()
  const visibility = createFakeVisibility(visible)
  const login = fakeRememberedLogin(remembered)
  const changes: AccountChange[] = []
  const remoteSignOuts: { origin: string }[] = []
  const identity = createWebSessionIdentity({
    session: { apiBaseUrl: API, fetchImpl },
    principal: { kind: 'account', rememberedLogin: login },
    origin: ORIGIN,
    heartbeat: { visibility: visibility.port, crossTab: site?.() },
    schedule: scheduler.schedule,
    onAccountChanged: (change) => changes.push(change),
    onSignedOutRemotely: (event) => remoteSignOuts.push(event)
  })
  identity.boot()
  return { scheduler, visibility, login, changes, remoteSignOuts, identity }
}

function liveEndpoint(
  state: FakeWebSessionState = { kind: 'live', user: USER_1 }
) {
  return createFakeWebSessionEndpoint({ state, signInUser: USER_2 })
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function summarize(state: WebSessionIdentityState): string {
  if (state.phase === 'signed_in') return `signed_in:${state.session.user.id}`
  if (state.phase === 'signed_out') return `signed_out:${state.outcome}`
  return state.phase
}

function methods(endpoint: FakeWebSessionEndpoint): string[] {
  return endpoint.requests.map(({ method }) => method)
}

describe('heartbeat', () => {
  it('reads every 10 minutes while visible, with GET only', async () => {
    const endpoint = liveEndpoint()
    const tab = openTab({ endpoint })
    await settle()
    expect(tab.scheduler.delays()).toEqual([HEARTBEAT_MS])

    tab.scheduler.fire(HEARTBEAT_MS)
    await settle()
    tab.scheduler.fire(HEARTBEAT_MS)
    await settle()

    expect(methods(endpoint)).toEqual(['GET', 'GET', 'GET'])
    expect(tab.scheduler.delays()).toEqual([HEARTBEAT_MS])
  })

  it('arms nothing on a hidden tab and reads at once when it becomes visible', async () => {
    const endpoint = liveEndpoint()
    const tab = openTab({ endpoint, visible: false })
    await settle()
    expect(tab.scheduler.delays()).toEqual([])

    tab.visibility.set(true)
    await settle()

    expect(methods(endpoint)).toEqual(['GET', 'GET'])
    expect(tab.scheduler.delays()).toEqual([HEARTBEAT_MS])

    tab.visibility.set(false)
    expect(tab.scheduler.delays()).toEqual([])
  })

  it('stops for good on dispose', async () => {
    const endpoint = liveEndpoint()
    const tab = openTab({ endpoint })
    await settle()

    tab.identity.dispose()
    tab.visibility.set(true)
    await settle()

    expect(tab.scheduler.delays()).toEqual([])
    expect(methods(endpoint)).toEqual(['GET'])
  })
})

describe('tabs of one site', () => {
  it('lets only the leader read; followers adopt its answer', async () => {
    const endpoint = liveEndpoint()
    const site = createFakeSiteBus()
    const leader = openTab({ endpoint, site })
    const follower = openTab({ endpoint, site })
    await settle()
    expect(follower.scheduler.delays()).toEqual([])

    endpoint.state = { kind: 'live', user: USER_2 }
    leader.scheduler.fire(HEARTBEAT_MS)
    await settle()

    expect(methods(endpoint)).toEqual(['GET', 'GET', 'GET'])
    expect(summarize(follower.identity.getState())).toBe('signed_in:user-2')
    expect(follower.changes).toEqual([
      expect.objectContaining({ reason: 'user_changed', epoch: 1 })
    ])
  })

  it('hands leadership to a visible sibling when the leader is hidden', async () => {
    const endpoint = liveEndpoint()
    const site = createFakeSiteBus()
    const first = openTab({ endpoint, site })
    const second = openTab({ endpoint, site })
    await settle()

    first.visibility.set(false)
    await settle()

    expect(first.scheduler.delays()).toEqual([])
    expect(second.scheduler.delays()).toEqual([HEARTBEAT_MS])
  })

  it('ignores a message that is not a session answer', async () => {
    const endpoint = liveEndpoint()
    const site = createFakeSiteBus()
    const tab = openTab({ endpoint, site })
    await settle()

    site().publishCredential('any', {
      from: 'heartbeat',
      result: { status: 'error', code: 'NO_SESSION', retryable: false }
    })
    await settle()

    expect(summarize(tab.identity.getState())).toBe('signed_in:user-1')
  })

  it('follows a sibling that signs in or out', async () => {
    const endpoint = liveEndpoint({ kind: 'dead', code: 'no_session' })
    const site = createFakeSiteBus()
    const acting = openTab({ endpoint, site, remembered: null })
    const sibling = openTab({ endpoint, site, remembered: null })
    await settle()

    await acting.identity.signedIn(async () => 'fresh-proof')
    await settle()
    expect(summarize(sibling.identity.getState())).toBe('signed_in:user-2')

    await acting.identity.signOut()
    await settle()
    expect(summarize(sibling.identity.getState())).toBe('signed_out:revoked')
    expect(sibling.login.signOutLocally).toHaveBeenCalledOnce()
    expect(sibling.remoteSignOuts).toEqual([])
  })

  it('a sign-out during an interactive sign-in wins, in this tab and its siblings', async () => {
    const endpoint = liveEndpoint({ kind: 'dead', code: 'no_session' })
    const site = createFakeSiteBus()
    let releasePost = () => {}
    const postHeld = new Promise<void>((resolve) => {
      releasePost = resolve
    })
    const acting = openTab({
      endpoint,
      site,
      remembered: null,
      fetchImpl: async (input, init) => {
        if (init?.method === 'POST') await postHeld
        return endpoint.fetch(input, init)
      }
    })
    const sibling = openTab({ endpoint, site, remembered: null })
    await settle()

    const signingIn = acting.identity.signedIn(async () => 'fresh-proof')
    await settle()
    await acting.identity.signOut()
    releasePost()
    const answer = await signingIn
    await settle()

    expect(answer).toMatchObject({ status: 'error', code: 'SESSION_REVOKED' })
    expect(summarize(acting.identity.getState())).toBe('signed_out:signed_out')
    expect(summarize(sibling.identity.getState())).toBe('signed_out:signed_out')
    expect(methods(endpoint).slice(-4)).toEqual([
      'DELETE',
      'POST',
      'GET',
      'DELETE'
    ])
  })

  it('a tab that signed out is not signed back in by a sibling heartbeat', async () => {
    const endpoint = liveEndpoint()
    const site = createFakeSiteBus()
    const tab = openTab({ endpoint, site })
    await settle()

    await tab.identity.signOut()
    const lateAnswer: WebSessionSharedMessage = {
      from: 'heartbeat',
      result: {
        status: 'ok',
        session: {
          user: USER_1,
          csrfToken: 'csrf-late',
          expiresAt: Date.now() + HEARTBEAT_MS,
          absoluteExpiresAt: Date.now() + 2 * HEARTBEAT_MS
        }
      }
    }
    site().publishCredential('any', lateAnswer)
    await settle()

    expect(summarize(tab.identity.getState())).toBe('signed_out:signed_out')
    expect(tab.changes).toEqual([
      { reason: 'signed_out', outcome: 'signed_out', epoch: 1 }
    ])
  })

  it('one revocation is reported once, by the tab that read it', async () => {
    const endpoint = liveEndpoint()
    const site = createFakeSiteBus()
    const leader = openTab({ endpoint, site })
    const follower = openTab({ endpoint, site })
    await settle()

    endpoint.state = { kind: 'dead', code: 'session_revoked' }
    leader.scheduler.fire(HEARTBEAT_MS)
    await settle()

    expect(summarize(follower.identity.getState())).toBe('signed_out:revoked')
    expect(follower.login.signOutLocally).toHaveBeenCalledOnce()
    expect(leader.remoteSignOuts).toEqual([{ origin: ORIGIN }])
    expect(follower.remoteSignOuts).toEqual([])
  })
})

describe('signing in and out', () => {
  it('creates a session only through an interactive sign-in, never on a beat', async () => {
    const endpoint = liveEndpoint({ kind: 'dead', code: 'no_session' })
    const tab = openTab({ endpoint, remembered: null })
    await settle()
    expect(summarize(tab.identity.getState())).toBe('signed_out:signed_out')

    const result = await tab.identity.signedIn(async () => 'fresh-proof')
    await settle()
    tab.scheduler.fire(HEARTBEAT_MS)
    await settle()
    tab.scheduler.fire(HEARTBEAT_MS)
    await settle()

    expect(result.status).toBe('ok')
    expect(summarize(tab.identity.getState())).toBe('signed_in:user-2')
    expect(methods(endpoint)).toEqual(['GET', 'POST', 'GET', 'GET', 'GET'])
    expect(tab.login.getProof).not.toHaveBeenCalled()
  })

  it('signs out at once and deletes the session, even a dead one', async () => {
    const endpoint = liveEndpoint()
    const tab = openTab({ endpoint })
    await settle()
    endpoint.state = { kind: 'dead', code: 'session_expired' }

    const deleting = tab.identity.signOut()
    expect(summarize(tab.identity.getState())).toBe('signed_out:signed_out')

    expect(await deleting).toEqual({ status: 'ok' })
    expect(methods(endpoint)).toEqual(['GET', 'DELETE'])
    expect(tab.login.signOutLocally).toHaveBeenCalledOnce()
    expect(tab.changes).toEqual([
      { reason: 'signed_out', outcome: 'signed_out', epoch: 1 }
    ])
    expect(tab.remoteSignOuts).toEqual([])
    expect(tab.scheduler.delays()).toEqual([])
  })

  it('a sign-out on one site signs an open tab on another out at its next beat', async () => {
    const endpoint = liveEndpoint()
    const website = openTab({ endpoint, site: createFakeSiteBus() })
    const cloud = openTab({ endpoint, site: createFakeSiteBus() })
    await settle()

    await website.identity.signOut()
    cloud.scheduler.fire(HEARTBEAT_MS)
    await settle()

    expect(summarize(cloud.identity.getState())).toBe('signed_out:revoked')
    expect(cloud.login.signOutLocally).toHaveBeenCalledOnce()
    expect(cloud.remoteSignOuts).toEqual([{ origin: ORIGIN }])
    expect(cloud.changes).toEqual([
      { reason: 'signed_out', outcome: 'revoked', epoch: 1 }
    ])
  })
})

describe('account change under an open tab', () => {
  it('discards an answer started under the old account', async () => {
    const endpoint = liveEndpoint()
    const site = createFakeSiteBus()
    let holdNext = false
    let release: () => void = () => undefined
    const held: typeof fetch = async (input, init) => {
      const response = await endpoint.fetch(input, init)
      if (!holdNext) return response
      holdNext = false
      return new Promise((resolve) => {
        release = () => resolve(response)
      })
    }
    const leader = openTab({ endpoint, site })
    const stale = openTab({ endpoint, site, visible: false, fetchImpl: held })
    await settle()
    const pendingAction = stale.identity.getEpoch()

    holdNext = true
    stale.visibility.set(true)
    await settle()
    endpoint.state = { kind: 'live', user: USER_2 }
    leader.scheduler.fire(HEARTBEAT_MS)
    await settle()
    release()
    await settle()

    expect(summarize(stale.identity.getState())).toBe('signed_in:user-2')
    expect(stale.changes).toHaveLength(1)
    expect(stale.identity.getEpoch()).not.toBe(pendingAction)
  })
})

function session(userId: string, csrfToken = 'csrf-1'): WebSession {
  return {
    user: fakeWebSessionUser({ id: userId }),
    csrfToken,
    expiresAt: 1,
    absoluteExpiresAt: 2
  }
}

const SIGNED_IN: WebSessionIdentityState = {
  phase: 'signed_in',
  session: session('user-1')
}

function failure(
  code: Extract<WebSessionResult, { status: 'error' }>['code']
): WebSessionResult {
  return { status: 'error', code, retryable: code === 'SESSION_UNAVAILABLE' }
}

describe('a heartbeat answer while signed in', () => {
  it.for([
    {
      name: 'same user adopts the new CSRF token',
      result: { status: 'ok', session: session('user-1', 'csrf-2') },
      remembered: 'user-1',
      expected: {
        state: { phase: 'signed_in', session: session('user-1', 'csrf-2') },
        effects: []
      }
    },
    {
      name: 'another user replaces the account and signs the old login out',
      result: { status: 'ok', session: session('user-2') },
      remembered: 'user-1',
      expected: {
        state: { phase: 'signed_in', session: session('user-2') },
        effects: [
          { type: 'sign_out_locally' },
          {
            type: 'account_changed',
            change: { reason: 'user_changed', session: session('user-2') }
          }
        ]
      }
    },
    {
      name: 'SESSION_UNAVAILABLE keeps the account for the next beat',
      result: failure('SESSION_UNAVAILABLE'),
      remembered: 'user-1',
      expected: { state: SIGNED_IN, effects: [] }
    },
    {
      name: 'an ambiguous refusal keeps the account',
      result: failure('CSRF_STALE'),
      remembered: 'user-1',
      expected: { state: SIGNED_IN, effects: [] }
    },
    {
      name: 'revoked signs out remotely',
      result: failure('SESSION_REVOKED'),
      remembered: 'user-1',
      expected: {
        state: { phase: 'signed_out', outcome: 'revoked' },
        effects: [
          { type: 'sign_out_locally' },
          { type: 'report_signed_out_remotely' },
          {
            type: 'account_changed',
            change: { reason: 'signed_out', outcome: 'revoked' }
          }
        ]
      }
    },
    {
      name: 'no session with a remembered login restores in place',
      result: failure('NO_SESSION'),
      remembered: 'user-1',
      expected: {
        state: SIGNED_IN,
        effects: [{ type: 'restore', expectedUserId: 'user-1' }]
      }
    },
    {
      name: 'an expired session without a remembered login signs out',
      result: failure('SESSION_EXPIRED'),
      remembered: null,
      expected: {
        state: { phase: 'signed_out', outcome: 'signed_out' },
        effects: [
          {
            type: 'account_changed',
            change: { reason: 'signed_out', outcome: 'signed_out' }
          }
        ]
      }
    }
  ] satisfies {
    name: string
    result: WebSessionResult
    remembered: string | null
    expected: WebSessionIdentityTransition
  }[])('$name', ({ result, remembered, expected }) => {
    expect(
      transitionWebSessionIdentity(SIGNED_IN, {
        type: 'session_observed',
        from: 'this_tab',
        result,
        rememberedUserId: remembered
      })
    ).toEqual(expected)
  })

  it.for([
    { event: 'proof_errored', phase: 'signed_in' },
    { event: 'proof_missing', phase: 'signed_out' }
  ] as const)(
    'a heartbeat restore whose proof is $event leaves the tab $phase',
    ({ event, phase }) => {
      expect(
        transitionWebSessionIdentity(SIGNED_IN, { type: event }).state.phase
      ).toBe(phase)
    }
  )

  it('a failed heartbeat restore signs out instead of restoring again', () => {
    expect(
      transitionWebSessionIdentity(SIGNED_IN, {
        type: 'restore_answered',
        result: failure('NO_SESSION'),
        rememberedUserId: 'user-1'
      }).state
    ).toEqual({ phase: 'signed_out', outcome: 'restore_failed' })
  })
})
