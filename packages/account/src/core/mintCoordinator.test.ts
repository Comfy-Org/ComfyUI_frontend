import { describe, expect, it, vi } from 'vitest'

import type { InFlightMint } from './mintCoordinator.js'
import {
  canJoin,
  createMintCoordinator,
  selectFreshCredential
} from './mintCoordinator.js'
import type { AccountCredential, SessionResult } from './sessionContracts.js'

function credential(
  token: string,
  overrides: Partial<AccountCredential> = {}
): AccountCredential {
  return {
    token,
    expiresAt: 1_000_000,
    uid: 'uid-1',
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    permissions: ['workspace:read'],
    ...overrides
  }
}

function deferred() {
  let resolve!: (result: SessionResult) => void
  const promise = new Promise<SessionResult>((r) => (resolve = r))
  return { promise, resolve }
}

const ok = (session: AccountCredential): SessionResult => ({
  status: 'ok',
  session
})

describe('selectFreshCredential', () => {
  const fresh = credential('fresh')
  const stale = credential('stale', { expiresAt: 500_000 })
  const now = 400_000
  const margin = 300_000

  it.for<{
    name: string
    memory: AccountCredential | undefined
    memoryTarget: string | undefined
    stored: { credential: AccountCredential; target: string | undefined }
    target: string | undefined
    expected: string | undefined
  }>([
    {
      name: 'a fresh in-memory credential for the target wins over storage',
      memory: fresh,
      memoryTarget: 'ws-1',
      stored: { credential: credential('stored'), target: 'ws-1' },
      target: 'ws-1',
      expected: 'fresh'
    },
    {
      name: 'a stale in-memory credential falls through to fresh storage',
      memory: stale,
      memoryTarget: 'ws-1',
      stored: { credential: credential('stored'), target: 'ws-1' },
      target: 'ws-1',
      expected: 'stored'
    },
    {
      name: 'an in-memory credential for another target is skipped',
      memory: fresh,
      memoryTarget: 'ws-9',
      stored: { credential: credential('stored'), target: 'ws-1' },
      target: 'ws-1',
      expected: 'stored'
    },
    {
      name: 'a stored credential for another target is skipped',
      memory: undefined,
      memoryTarget: undefined,
      stored: { credential: credential('stored'), target: 'ws-9' },
      target: undefined,
      expected: undefined
    },
    {
      name: 'an in-memory credential for another user is skipped',
      memory: credential('other', { uid: 'uid-2' }),
      memoryTarget: 'ws-1',
      stored: { credential: stale, target: 'ws-1' },
      target: 'ws-1',
      expected: undefined
    },
    {
      name: 'nothing fresh anywhere yields no candidate',
      memory: stale,
      memoryTarget: 'ws-1',
      stored: { credential: stale, target: 'ws-1' },
      target: 'ws-1',
      expected: undefined
    }
  ])('$name', ({ memory, memoryTarget, stored, target, expected }) => {
    const selected = selectFreshCredential(
      [{ credential: memory, target: memoryTarget }, stored],
      'uid-1',
      target,
      now,
      margin
    )

    expect(selected?.token).toBe(expected)
  })

  it('treats a storage miss as no candidate', () => {
    expect(
      selectFreshCredential(
        [{ credential: undefined, target: undefined }, undefined],
        'uid-1',
        undefined,
        now,
        margin
      )
    ).toBeUndefined()
  })
})

describe('canJoin', () => {
  const running: InFlightMint = {
    promise: Promise.resolve(ok(credential('x'))),
    uid: 'uid-1',
    target: 'ws-1',
    forced: false,
    mintId: 1
  }

  it.for<{
    name: string
    inFlight: InFlightMint | undefined
    uid: string
    target: string | undefined
    forced: boolean
    joins: boolean
  }>([
    {
      name: 'nothing in flight',
      inFlight: undefined,
      uid: 'uid-1',
      target: 'ws-1',
      forced: false,
      joins: false
    },
    {
      name: 'same user and target, unforced',
      inFlight: running,
      uid: 'uid-1',
      target: 'ws-1',
      forced: false,
      joins: true
    },
    {
      name: 'another user',
      inFlight: running,
      uid: 'uid-2',
      target: 'ws-1',
      forced: false,
      joins: false
    },
    {
      name: 'another target',
      inFlight: running,
      uid: 'uid-1',
      target: 'ws-9',
      forced: false,
      joins: false
    },
    {
      name: 'a forced mint over an unforced one',
      inFlight: running,
      uid: 'uid-1',
      target: 'ws-1',
      forced: true,
      joins: false
    },
    {
      name: 'a forced mint over a forced one',
      inFlight: { ...running, forced: true },
      uid: 'uid-1',
      target: 'ws-1',
      forced: true,
      joins: true
    },
    {
      name: 'an unforced mint over a forced one',
      inFlight: { ...running, forced: true },
      uid: 'uid-1',
      target: 'ws-1',
      forced: false,
      joins: true
    }
  ])('$name', ({ inFlight, uid, target, forced, joins }) => {
    expect(canJoin(inFlight, uid, target, forced)).toBe(joins)
  })
})

describe('createMintCoordinator', () => {
  it('lets a second caller join the running mint instead of starting its own', async () => {
    const mints = createMintCoordinator()
    const first = deferred()
    const start = vi.fn(() => ({ mintId: 1, response: first.promise }))

    const owner = mints.dispatch('uid-1', undefined, false, start)
    const joiner = mints.dispatch('uid-1', undefined, false, start)
    first.resolve(ok(credential('shared')))

    expect(start).toHaveBeenCalledOnce()
    expect(joiner).toMatchObject({ mintId: 1, joined: true })
    expect(await joiner.response).toEqual(await owner.response)
  })

  it('starts a fresh mint once the running one has settled', async () => {
    const mints = createMintCoordinator()
    const first = deferred()
    let mintId = 0
    const start = vi.fn(() => ({
      mintId: (mintId += 1),
      response: first.promise
    }))

    const owner = mints.dispatch('uid-1', undefined, false, start)
    first.resolve(ok(credential('done')))
    await owner.response

    expect(mints.dispatch('uid-1', undefined, false, start).joined).toBe(false)
    expect(start).toHaveBeenCalledTimes(2)
  })

  it('an older mint settling does not clear a newer forced mint', async () => {
    const mints = createMintCoordinator()
    const older = deferred()
    const forced = deferred()
    const start = vi
      .fn<() => { mintId: number; response: Promise<SessionResult> }>()
      .mockReturnValueOnce({ mintId: 1, response: older.promise })
      .mockReturnValueOnce({ mintId: 2, response: forced.promise })

    const first = mints.dispatch('uid-1', undefined, false, start)
    mints.dispatch('uid-1', undefined, true, start)
    older.resolve(ok(credential('older')))
    await first.response

    expect(
      mints.dispatch('uid-1', undefined, true, start),
      'the forced mint is still in flight and a forced caller joins it'
    ).toMatchObject({ mintId: 2, joined: true })
    expect(start).toHaveBeenCalledTimes(2)
  })

  it('abandon makes the next caller start its own mint', () => {
    const mints = createMintCoordinator()
    const start = vi.fn(() => ({ mintId: 1, response: deferred().promise }))
    mints.dispatch('uid-1', undefined, false, start)

    mints.abandon()

    expect(mints.dispatch('uid-1', undefined, false, start).joined).toBe(false)
    expect(start).toHaveBeenCalledTimes(2)
  })
})
