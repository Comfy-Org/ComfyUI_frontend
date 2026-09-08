import { describe, expect, it, vi } from 'vitest'

import { createBillingClient } from './credits.js'
import type { AccountCredential, SessionResult } from './session.js'

const BALANCE_URL = 'https://cloud.test/api/billing/balance'

function credentialFor(uid: string, token: string): AccountCredential {
  return {
    token,
    uid,
    expiresAt: Date.now() + 90 * 60 * 1000,
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: []
  }
}

function fakeSession(initial?: AccountCredential) {
  let credential = initial
  return {
    set: (next?: AccountCredential) => {
      credential = next
    },
    getSnapshot: () =>
      credential
        ? ({
            phase: 'authenticated',
            user: { uid: credential.uid, getIdToken: async () => 'id' },
            session: credential
          } as const)
        : ({ phase: 'signed-out', user: null, session: undefined } as const),
    remint: vi.fn(async (): Promise<SessionResult | undefined> => {
      const next = credentialFor(credential?.uid ?? 'uid-1', 'jwt-2')
      credential = next
      return { status: 'ok', session: next }
    })
  }
}

function balanceResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function makeClient(
  session: ReturnType<typeof fakeSession>,
  fetchImpl: typeof fetch,
  timeoutMs?: number
) {
  return createBillingClient({
    session,
    balanceUrl: BALANCE_URL,
    fetchImpl,
    timeoutMs
  })
}

describe('createBillingClient', () => {
  it('publishes the balance for a live session', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      balanceResponse({ effective_balance_micros: 1234 })
    )
    const client = makeClient(session, fetchImpl)

    await client.refresh()

    expect(client.getState()).toEqual({ status: 'ok', cents: 1234 })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(BALANCE_URL)
    const headers = new Headers(init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer jwt-1')
  })

  it('falls back to amount_micros when the effective field is absent', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    const client = makeClient(
      session,
      vi.fn<typeof fetch>(async () => balanceResponse({ amount_micros: 777 }))
    )

    await client.refresh()

    expect(client.getState()).toEqual({ status: 'ok', cents: 777 })
  })

  it('re-mints once on a stale token and retries with the new token', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => balanceResponse({}, 401))
      .mockImplementationOnce(async () =>
        balanceResponse({ effective_balance_micros: 500 })
      )
    const client = makeClient(session, fetchImpl)

    await client.refresh()

    expect(session.remint).toHaveBeenCalledOnce()
    const [, retryInit] = fetchImpl.mock.calls[1]
    const headers = new Headers(retryInit?.headers)
    expect(
      headers.get('Authorization'),
      'the retry must carry the reminted token, not replay the stale one'
    ).toBe('Bearer jwt-2')
    expect(client.getState()).toEqual({ status: 'ok', cents: 500 })
  })

  it("spends the 401 re-mint for the read's owner, never the current identity", async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    let release!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (release = resolve))
      )
      .mockImplementationOnce(async () =>
        balanceResponse({ effective_balance_micros: 500 })
      )
    const client = makeClient(session, fetchImpl)

    const refreshing = client.refresh()
    session.set(credentialFor('uid-2', 'jwt-b'))
    release(balanceResponse({}, 401))
    await refreshing

    expect(
      session.remint,
      "a stale 401 belonging to the read's owner must not burn a forced mint against the switched-in identity"
    ).toHaveBeenCalledWith(expect.objectContaining({ uid: 'uid-1' }))
  })

  it('settles on the error state when the retry also fails, never NaN', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    const fetchImpl = vi.fn<typeof fetch>(async () => balanceResponse({}, 401))
    const client = makeClient(session, fetchImpl)

    await client.refresh()

    expect(session.remint).toHaveBeenCalledOnce()
    expect(client.getState()).toEqual({ status: 'error', unauthorized: true })
  })

  it('does nothing while signed out', async () => {
    const session = fakeSession()
    const fetchImpl = vi.fn<typeof fetch>()
    const client = makeClient(session, fetchImpl)

    await client.refresh()

    expect(client.getState()).toEqual({ status: 'unknown' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('a read resolving after reset() must not resurrect the abandoned state', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    let release!: (response: Response) => void
    const client = makeClient(
      session,
      vi.fn<typeof fetch>(
        () => new Promise<Response>((resolve) => (release = resolve))
      )
    )

    const refreshing = client.refresh()
    client.reset()
    release(balanceResponse({ effective_balance_micros: 999 }))
    await refreshing

    expect(
      client.getState(),
      'reset() abandons the in-flight read; its late result must not overwrite the cleared state'
    ).toEqual({ status: 'unknown' })
  })

  it('reset() also abandons a forced read queued behind an in-flight one', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    let release!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (release = resolve))
      )
      .mockImplementation(async () =>
        balanceResponse({ effective_balance_micros: 42 })
      )
    const client = makeClient(session, fetchImpl)

    const plain = client.refresh()
    const forced = client.refresh({ force: true })
    client.reset()
    release(balanceResponse({ effective_balance_micros: 7 }))
    await Promise.all([plain, forced])

    expect(
      client.getState(),
      'the queued forced continuation restarts with a post-reset generation, so the generation guard alone cannot catch it'
    ).toEqual({ status: 'unknown' })
  })

  it('a same-user caller joins the in-flight read across a mid-read token rotation', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    let releaseRetry!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => balanceResponse({}, 401))
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (releaseRetry = resolve))
      )
      .mockImplementation(async () =>
        balanceResponse({ effective_balance_micros: 500 })
      )
    const client = makeClient(session, fetchImpl)

    const first = client.refresh()
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2))
    const second = client.refresh()
    releaseRetry(balanceResponse({ effective_balance_micros: 500 }))
    await Promise.all([first, second])

    expect(
      fetchImpl,
      'the re-mint rotates the token mid-read; a same-user caller must still join, not race a duplicate read'
    ).toHaveBeenCalledTimes(2)
    expect(client.getState()).toEqual({ status: 'ok', cents: 500 })
  })

  it('does not publish a balance that belongs to a superseded user', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    let release!: (response: Response) => void
    const client = makeClient(
      session,
      vi.fn<typeof fetch>(
        () => new Promise<Response>((resolve) => (release = resolve))
      )
    )

    const pending = client.refresh()
    session.set(credentialFor('uid-2', 'jwt-1'))
    release(balanceResponse({ effective_balance_micros: 999 }))
    await pending

    expect(
      client.getState(),
      'a balance fetched for the previous user must never repaint the new session'
    ).toEqual({ status: 'unknown' })
  })

  it('does not publish a balance fetched with a superseded token', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    let release!: (response: Response) => void
    const client = makeClient(
      session,
      vi.fn<typeof fetch>(
        () => new Promise<Response>((resolve) => (release = resolve))
      )
    )

    const pending = client.refresh()
    session.set(credentialFor('uid-1', 'jwt-9'))
    release(balanceResponse({ effective_balance_micros: 999 }))
    await pending

    expect(client.getState()).toEqual({ status: 'unknown' })
  })

  it('bounds the balance read with an abort signal', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    const client = makeClient(
      session,
      vi.fn<typeof fetch>(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('TimedOut', 'TimeoutError'))
            )
          })
      ),
      1
    )

    await client.refresh()

    expect(client.getState()).toEqual({ status: 'error' })
  })

  it('shares one in-flight read across overlapping triggers', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    let release!: (response: Response) => void
    const fetchImpl = vi.fn<typeof fetch>(
      () => new Promise<Response>((resolve) => (release = resolve))
    )
    const client = makeClient(session, fetchImpl)

    const first = client.refresh()
    const second = client.refresh()
    release(balanceResponse({ effective_balance_micros: 100 }))
    await Promise.all([first, second])

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(client.getState()).toEqual({ status: 'ok', cents: 100 })
  })

  it('queues a forced refresh behind an older read already in flight', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    let release!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (release = resolve))
      )
      .mockImplementationOnce(async () =>
        balanceResponse({ effective_balance_micros: 250 })
      )
    const client = makeClient(session, fetchImpl)

    const stale = client.refresh()
    const forced = client.refresh({ force: true })
    release(balanceResponse({ effective_balance_micros: 100 }))
    await Promise.all([stale, forced])

    expect(
      fetchImpl,
      'a post-spend forced read must re-fetch, never be satisfied by the pre-spend read'
    ).toHaveBeenCalledTimes(2)
    expect(client.getState()).toEqual({ status: 'ok', cents: 250 })
  })

  it('reset returns the state to unknown', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    const client = makeClient(
      session,
      vi.fn<typeof fetch>(async () =>
        balanceResponse({ effective_balance_micros: 42 })
      )
    )
    await client.refresh()

    client.reset()

    expect(client.getState()).toEqual({ status: 'unknown' })
  })
})
