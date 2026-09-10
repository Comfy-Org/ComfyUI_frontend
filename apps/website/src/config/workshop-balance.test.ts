// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

import type { User } from 'firebase/auth'

import type {
  AccountCredential,
  SessionResult
} from '@comfyorg/account/session'
import type { BillingBalanceResponse } from '@comfyorg/ingest-types'

import { createBalanceReader } from './workshop-balance'

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

function userFor(uid: string): User {
  return { uid, getIdToken: async () => 'id' } as Partial<User> as User
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
            user: userFor(credential.uid),
            session: credential,
            settled: true
          } as const)
        : ({
            phase: 'signed-out',
            user: null,
            session: undefined,
            settled: true
          } as const),
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

/** A contract-valid balance body; the reader reads the effective field. */
function balanceBody(cents: number): BillingBalanceResponse {
  return {
    amount_micros: cents,
    currency: 'usd',
    effective_balance_micros: cents
  }
}

function deferredFetch() {
  let release!: (response: Response) => void
  const fetchImpl = vi.fn<typeof fetch>(
    () => new Promise<Response>((resolve) => (release = resolve))
  )
  return { fetchImpl, release: (response: Response) => release(response) }
}

describe('createBalanceReader', () => {
  it('publishes the balance for a live session with the session token', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      balanceResponse(balanceBody(1234))
    )
    const reader = createBalanceReader(session, BALANCE_URL, fetchImpl)

    await reader.refresh()

    expect(reader.getState()).toEqual({ status: 'ok', cents: 1234 })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(BALANCE_URL)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jwt-1')
  })

  it('falls back to amount_micros when the effective field is absent', async () => {
    const reader = createBalanceReader(
      fakeSession(credentialFor('uid-1', 'jwt-1')),
      BALANCE_URL,
      vi.fn<typeof fetch>(async () =>
        balanceResponse({ amount_micros: 777, currency: 'usd' })
      )
    )

    await reader.refresh()

    expect(reader.getState()).toEqual({ status: 'ok', cents: 777 })
  })

  it('rejects a partial body that omits the contract-required fields', async () => {
    const reader = createBalanceReader(
      fakeSession(credentialFor('uid-1', 'jwt-1')),
      BALANCE_URL,
      vi.fn<typeof fetch>(async () =>
        balanceResponse({ effective_balance_micros: 1234 })
      )
    )

    await reader.refresh()

    expect(
      reader.getState(),
      'a body without amount_micros/currency is not the billing contract'
    ).toEqual({ status: 'error' })
  })

  it('rejects a non-finite balance the schema would otherwise admit', async () => {
    // Infinity cannot survive JSON on the wire; hand-build to reach the guard.
    const reader = createBalanceReader(
      fakeSession(credentialFor('uid-1', 'jwt-1')),
      BALANCE_URL,
      vi.fn<typeof fetch>(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({
              amount_micros: Number.POSITIVE_INFINITY,
              currency: 'usd'
            })
          }) as Partial<Response> as Response
      )
    )

    await reader.refresh()

    expect(reader.getState()).toEqual({ status: 'error' })
  })

  it('re-mints once on a stale token and retries with the new token', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => balanceResponse({}, 401))
      .mockImplementationOnce(async () => balanceResponse(balanceBody(500)))
    const reader = createBalanceReader(session, BALANCE_URL, fetchImpl)

    await reader.refresh()

    expect(session.remint).toHaveBeenCalledOnce()
    const [, retryInit] = fetchImpl.mock.calls[1]
    expect(
      new Headers(retryInit?.headers).get('Authorization'),
      'the retry must carry the reminted token, not replay the stale one'
    ).toBe('Bearer jwt-2')
    expect(reader.getState()).toEqual({ status: 'ok', cents: 500 })
  })

  it("spends the 401 re-mint for the read's owner, never the current identity", async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    let release!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (release = resolve))
      )
      .mockImplementationOnce(async () => balanceResponse(balanceBody(500)))
    const reader = createBalanceReader(session, BALANCE_URL, fetchImpl)

    const refreshing = reader.refresh()
    session.set(credentialFor('uid-2', 'jwt-b'))
    release(balanceResponse({}, 401))
    await refreshing

    expect(session.remint).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'uid-1' })
    )
  })

  it('settles on the error state when the retry also fails', async () => {
    const reader = createBalanceReader(
      fakeSession(credentialFor('uid-1', 'jwt-1')),
      BALANCE_URL,
      vi.fn<typeof fetch>(async () => balanceResponse({}, 401))
    )

    await reader.refresh()

    expect(reader.getState()).toEqual({ status: 'error', unauthorized: true })
  })

  it('does nothing while signed out', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const reader = createBalanceReader(fakeSession(), BALANCE_URL, fetchImpl)

    await reader.refresh()

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(reader.getState()).toEqual({ status: 'unknown' })
  })

  it('a read resolving after reset() must not resurrect the abandoned state', async () => {
    const { fetchImpl, release } = deferredFetch()
    const reader = createBalanceReader(
      fakeSession(credentialFor('uid-1', 'jwt-1')),
      BALANCE_URL,
      fetchImpl
    )

    const refreshing = reader.refresh()
    reader.reset()
    release(balanceResponse(balanceBody(999)))
    await refreshing

    expect(reader.getState()).toEqual({ status: 'unknown' })
  })

  it('does not publish a balance that belongs to a superseded user', async () => {
    const session = fakeSession(credentialFor('uid-1', 'jwt-1'))
    const { fetchImpl, release } = deferredFetch()
    const reader = createBalanceReader(session, BALANCE_URL, fetchImpl)

    const refreshing = reader.refresh()
    session.set(credentialFor('uid-2', 'jwt-b'))
    release(balanceResponse(balanceBody(42)))
    await refreshing

    expect(reader.getState()).toEqual({ status: 'unknown' })
  })

  it('shares one in-flight read across overlapping triggers', async () => {
    const { fetchImpl, release } = deferredFetch()
    const reader = createBalanceReader(
      fakeSession(credentialFor('uid-1', 'jwt-1')),
      BALANCE_URL,
      fetchImpl
    )

    const first = reader.refresh()
    const second = reader.refresh()
    release(balanceResponse(balanceBody(5)))
    await Promise.all([first, second])

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(reader.getState()).toEqual({ status: 'ok', cents: 5 })
  })

  it('queues a forced refresh behind an older read already in flight', async () => {
    let release!: (response: Response) => void
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (release = resolve))
      )
      .mockImplementationOnce(async () => balanceResponse(balanceBody(7)))
    const reader = createBalanceReader(
      fakeSession(credentialFor('uid-1', 'jwt-1')),
      BALANCE_URL,
      fetchImpl
    )

    const first = reader.refresh()
    const forced = reader.refresh({ force: true })
    release(balanceResponse(balanceBody(1)))
    await Promise.all([first, forced])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(
      reader.getState(),
      'the forced read must land after the older one, so a rotation is never lost to a doomed read'
    ).toEqual({ status: 'ok', cents: 7 })
  })
})
