import { describe, expect, it, vi } from 'vitest'

import { credential, deferred } from './__fixtures__/sessionFakes.js'
import type { InFlightMint } from './mintCoordinator.js'
import { canJoin, createMintCoordinator } from './mintCoordinator.js'
import type { AccountCredential, SessionResult } from './sessionContracts.js'

const ok = (session: AccountCredential): SessionResult => ({
  status: 'ok',
  session
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
    const first = deferred<SessionResult>()
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
    const first = deferred<SessionResult>()
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
    const older = deferred<SessionResult>()
    const forced = deferred<SessionResult>()
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
    const start = vi.fn(() => ({
      mintId: 1,
      response: deferred<SessionResult>().promise
    }))
    mints.dispatch('uid-1', undefined, false, start)

    mints.abandon()

    expect(mints.dispatch('uid-1', undefined, false, start).joined).toBe(false)
    expect(start).toHaveBeenCalledTimes(2)
  })
})
