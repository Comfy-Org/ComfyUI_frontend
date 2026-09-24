import { describe, expect, it, vi } from 'vitest'

import type { FakeWebSessionState } from '../testing.js'
import { createFakeWebSessionEndpoint, fakeWebSessionUser } from '../testing.js'
import type { WebSessionFailure } from './sessionContracts.js'
import type {
  RememberedLogin,
  ScheduleRetry,
  WebSessionBootstrapEvent,
  WebSessionIdentity,
  WebSessionIdentityState
} from './webSessionIdentity.js'
import {
  createWebSessionIdentity,
  transitionWebSessionIdentity
} from './webSessionIdentity.js'

const API = 'https://cloud.example/api'
const ORIGIN = 'https://www.comfy.example'
const SESSION_USER = fakeWebSessionUser({ id: 'user-1' })

function createFakeScheduler() {
  const pending: { run: () => void; delayMs: number }[] = []
  const schedule: ScheduleRetry = (run, delayMs) => {
    const timer = { run, delayMs }
    pending.push(timer)
    return () => {
      pending.splice(pending.indexOf(timer), 1)
    }
  }
  return {
    schedule,
    delays: () => pending.map(({ delayMs }) => delayMs),
    fireNext: () => pending.shift()?.run()
  }
}

function fakeRememberedLogin(
  userId: string | null,
  getProof: () => Promise<string | null> = async () => 'remembered-proof'
) {
  return {
    currentUserId: vi.fn(async () => userId),
    getProof: vi.fn(getProof),
    signOutLocally: vi.fn(async () => undefined)
  } satisfies RememberedLogin
}

function bootIdentity({
  state,
  login,
  fetchImpl
}: {
  state: FakeWebSessionState
  login: RememberedLogin
  fetchImpl?: (endpointFetch: typeof fetch) => typeof fetch
}) {
  const endpoint = createFakeWebSessionEndpoint({
    state,
    signInUser: SESSION_USER
  })
  const scheduler = createFakeScheduler()
  const reports: WebSessionBootstrapEvent[] = []
  const identity = createWebSessionIdentity({
    session: {
      apiBaseUrl: API,
      fetchImpl: fetchImpl ? fetchImpl(endpoint.fetch) : endpoint.fetch
    },
    principal: { kind: 'account', rememberedLogin: login },
    origin: ORIGIN,
    onBootstrap: (event) => reports.push(event),
    schedule: scheduler.schedule
  })
  identity.boot()
  return { endpoint, scheduler, reports, identity }
}

const RESTING_PHASES: ReadonlySet<WebSessionIdentityState['phase']> = new Set([
  'signed_in',
  'signed_out',
  'retry_wait'
])

function nextRest(
  identity: WebSessionIdentity
): Promise<WebSessionIdentityState> {
  return new Promise((resolve) => {
    const unsubscribe = identity.subscribe((state) => {
      if (!RESTING_PHASES.has(state.phase)) return
      queueMicrotask(unsubscribe)
      resolve(state)
    })
  })
}

function summarize(state: WebSessionIdentityState): string {
  if (state.phase === 'signed_in') return `signed_in:${state.session.user.id}`
  if (state.phase === 'signed_out') return `signed_out:${state.outcome}`
  return state.phase
}

function requestLog(endpoint: { requests: readonly { method: string }[] }) {
  return endpoint.requests.map(({ method }) => method)
}

describe('how a site boots', () => {
  it.for([
    {
      name: '200 with the same remembered user signs in',
      state: { kind: 'live', user: SESSION_USER },
      remembered: 'user-1',
      expected: 'signed_in:user-1',
      localSignOuts: 0,
      requests: ['GET'],
      outcomes: ['signed_in']
    },
    {
      name: '200 with a different remembered user signs in and signs that login out',
      state: { kind: 'live', user: SESSION_USER },
      remembered: 'user-2',
      expected: 'signed_in:user-1',
      localSignOuts: 1,
      requests: ['GET'],
      outcomes: ['signed_in']
    },
    {
      name: '401 session_revoked signs out locally and never restores',
      state: { kind: 'dead', code: 'session_revoked' },
      remembered: 'user-1',
      expected: 'signed_out:revoked',
      localSignOuts: 1,
      requests: ['GET'],
      outcomes: ['revoked']
    },
    {
      name: '401 no_session with a remembered login restores once',
      state: { kind: 'dead', code: 'no_session' },
      remembered: 'user-1',
      expected: 'signed_in:user-1',
      localSignOuts: 0,
      requests: ['GET', 'POST', 'GET'],
      outcomes: ['restored']
    },
    {
      name: '401 session_expired with a remembered login restores once',
      state: { kind: 'dead', code: 'session_expired' },
      remembered: 'user-1',
      expected: 'signed_in:user-1',
      localSignOuts: 0,
      requests: ['GET', 'POST', 'GET'],
      outcomes: ['restored']
    },
    {
      name: '401 no_session without a remembered login is signed out',
      state: { kind: 'dead', code: 'no_session' },
      remembered: null,
      expected: 'signed_out:signed_out',
      localSignOuts: 0,
      requests: ['GET'],
      outcomes: ['signed_out']
    },
    {
      name: 'a network error stays pending and never signs out',
      state: { kind: 'network_error' },
      remembered: 'user-1',
      expected: 'retry_wait',
      localSignOuts: 0,
      requests: ['GET'],
      outcomes: []
    }
  ] satisfies {
    name: string
    state: FakeWebSessionState
    remembered: string | null
    expected: string
    localSignOuts: number
    requests: string[]
    outcomes: string[]
  }[])(
    '$name',
    async ({
      state,
      remembered,
      expected,
      localSignOuts,
      requests,
      outcomes
    }) => {
      const login = fakeRememberedLogin(remembered)
      const { endpoint, reports, identity } = bootIdentity({ state, login })

      const settled = await nextRest(identity)

      expect(summarize(settled)).toBe(expected)
      expect(login.signOutLocally).toHaveBeenCalledTimes(localSignOuts)
      expect(requestLog(endpoint)).toEqual(requests)
      expect(reports).toEqual(
        outcomes.map((outcome) => ({ outcome, origin: ORIGIN }))
      )
    }
  )
})

describe('network errors', () => {
  it('retries with doubling backoff until the session answers', async () => {
    const login = fakeRememberedLogin('user-1')
    const { endpoint, scheduler, identity } = bootIdentity({
      state: { kind: 'network_error' },
      login
    })
    await nextRest(identity)
    expect(scheduler.delays()).toEqual([1000])

    scheduler.fireNext()
    await nextRest(identity)
    expect(scheduler.delays()).toEqual([2000])

    endpoint.state = { kind: 'live', user: SESSION_USER }
    scheduler.fireNext()

    expect(summarize(await nextRest(identity))).toBe('signed_in:user-1')
    expect(login.signOutLocally).not.toHaveBeenCalled()
  })

  it('dispose cancels the pending retry', async () => {
    const { scheduler, identity } = bootIdentity({
      state: { kind: 'network_error' },
      login: fakeRememberedLogin('user-1')
    })
    await nextRest(identity)

    identity.dispose()

    expect(scheduler.delays()).toEqual([])
    expect(identity.getState()).toEqual({ phase: 'idle' })
  })
})

function failingPosts(times: number, log: string[]) {
  let remaining = times
  return (endpointFetch: typeof fetch): typeof fetch =>
    async (input, init) => {
      log.push(init?.method ?? 'GET')
      if (init?.method !== 'POST' || remaining === 0) {
        return endpointFetch(input, init)
      }
      remaining -= 1
      throw new TypeError('Failed to fetch')
    }
}

describe('silent restore', () => {
  it('retries a restore lost to the network until it succeeds', async () => {
    const log: string[] = []
    const login = fakeRememberedLogin('user-1')
    const { scheduler, reports, identity } = bootIdentity({
      state: { kind: 'dead', code: 'no_session' },
      login,
      fetchImpl: failingPosts(2, log)
    })
    expect(summarize(await nextRest(identity))).toBe('retry_wait')
    expect(scheduler.delays()).toEqual([1000])

    scheduler.fireNext()
    expect(summarize(await nextRest(identity))).toBe('retry_wait')
    expect(scheduler.delays()).toEqual([2000])

    scheduler.fireNext()

    expect(summarize(await nextRest(identity))).toBe('signed_in:user-1')
    expect(log).toEqual(['GET', 'POST', 'GET', 'POST', 'GET', 'POST', 'GET'])
    expect(reports).toEqual([{ outcome: 'restored', origin: ORIGIN }])
    expect(login.signOutLocally).not.toHaveBeenCalled()
  })

  it('re-reads before restoring again, so a lost POST that landed is not repeated', async () => {
    const log: string[] = []
    const { scheduler, identity } = bootIdentity({
      state: { kind: 'dead', code: 'no_session' },
      login: fakeRememberedLogin('user-1'),
      fetchImpl: (endpointFetch) => async (input, init) => {
        log.push(init?.method ?? 'GET')
        const response = await endpointFetch(input, init)
        if (init?.method === 'POST') throw new TypeError('Failed to fetch')
        return response
      }
    })
    expect(summarize(await nextRest(identity))).toBe('retry_wait')

    scheduler.fireNext()

    expect(summarize(await nextRest(identity))).toBe('signed_in:user-1')
    expect(log).toEqual(['GET', 'POST', 'GET'])
  })

  it('settles signed out when the remembered login has no usable proof', async () => {
    const login = fakeRememberedLogin('user-1', async () => null)
    const { endpoint, reports, identity } = bootIdentity({
      state: { kind: 'dead', code: 'no_session' },
      login
    })

    expect(summarize(await nextRest(identity))).toBe(
      'signed_out:restore_failed'
    )
    expect(requestLog(endpoint)).toEqual(['GET'])
    expect(reports).toEqual([{ outcome: 'restore_failed', origin: ORIGIN }])
    expect(login.signOutLocally).not.toHaveBeenCalled()
  })

  it('treats a proof that throws as transient and restores on retry', async () => {
    const login = fakeRememberedLogin('user-1')
    login.getProof.mockRejectedValueOnce(new Error('provider offline'))
    const { endpoint, scheduler, identity } = bootIdentity({
      state: { kind: 'dead', code: 'no_session' },
      login
    })
    expect(summarize(await nextRest(identity))).toBe('retry_wait')
    expect(requestLog(endpoint)).toEqual(['GET'])

    scheduler.fireNext()

    expect(summarize(await nextRest(identity))).toBe('signed_in:user-1')
    expect(requestLog(endpoint)).toEqual(['GET', 'GET', 'POST', 'GET'])
    expect(login.signOutLocally).not.toHaveBeenCalled()
  })

  it.for([
    {
      code: 'IDENTITY_CHANGED',
      retryable: false,
      state: { phase: 'signed_out', outcome: 'restore_failed' },
      effects: [{ type: 'report', outcome: 'restore_failed' }]
    },
    {
      code: 'NO_SESSION',
      retryable: false,
      state: { phase: 'signed_out', outcome: 'restore_failed' },
      effects: [{ type: 'report', outcome: 'restore_failed' }]
    },
    {
      code: 'SESSION_REVOKED',
      retryable: false,
      state: { phase: 'signed_out', outcome: 'revoked' },
      effects: [
        { type: 'sign_out_locally' },
        { type: 'report', outcome: 'revoked' }
      ]
    },
    {
      code: 'SESSION_UNAVAILABLE',
      retryable: true,
      state: { phase: 'retry_wait', failures: 1 },
      effects: [{ type: 'schedule_retry', failures: 1 }]
    }
  ] satisfies (Pick<WebSessionFailure, 'code' | 'retryable'> &
    ReturnType<typeof transitionWebSessionIdentity>)[])(
    'a restore answered $code settles or waits, never restoring in place',
    ({ code, retryable, state, effects }) => {
      expect(
        transitionWebSessionIdentity(
          { phase: 'restoring', failures: 0 },
          {
            type: 'restore_answered',
            result: { status: 'error', code, retryable },
            rememberedUserId: 'user-1'
          }
        )
      ).toEqual({ state, effects })
    }
  )
})

describe('api-key principal', () => {
  it('never reads or creates a session', () => {
    const endpoint = createFakeWebSessionEndpoint({
      state: { kind: 'dead', code: 'no_session' }
    })
    const identity = createWebSessionIdentity({
      session: { apiBaseUrl: API, fetchImpl: endpoint.fetch },
      principal: { kind: 'api_key' },
      origin: ORIGIN
    })

    identity.boot()

    expect(identity.getState()).toEqual({ phase: 'api_key' })
    expect(endpoint.requests).toEqual([])
  })
})
