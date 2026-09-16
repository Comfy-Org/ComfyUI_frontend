import { describe, expect, it, vi } from 'vitest'

import { createTestIdentity } from '../testing.js'
import type { AccountIdentity } from './identity.js'
import type { LazyIdentity } from './lazyIdentity.js'
import { createLazyIdentity } from './lazyIdentity.js'
import { createSessionClient } from './session.js'
import type { AccountUser } from './sessionContracts.js'

const alice: AccountUser = { uid: 'alice', getIdToken: async () => 'token' }
const bob: AccountUser = { uid: 'bob', getIdToken: async () => 'token' }

function innerIdentity() {
  const callbacks = new Set<(user: AccountUser | null) => void>()
  let subscriptions = 0
  const identity = createTestIdentity<AccountUser>({
    onUserChanged: (callback) => {
      subscriptions += 1
      callbacks.add(callback)
      return () => {
        callbacks.delete(callback)
      }
    }
  })
  return {
    identity,
    fire: (user: AccountUser | null) =>
      callbacks.forEach((callback) => callback(user)),
    subscriptions: () => subscriptions,
    subscribed: () => callbacks.size
  }
}

function deferredLoader() {
  const inner = innerIdentity()
  let release!: () => void
  const loaded = new Promise<typeof inner.identity>((resolve) => {
    release = () => resolve(inner.identity)
  })
  return { inner, release, load: vi.fn(() => loaded) }
}

const noopStorage = { read: () => null, write: () => {}, clear: () => {} }

describe('createLazyIdentity', () => {
  it('registers listeners before activation without delivering or loading', async () => {
    const { inner, load } = deferredLoader()
    const port = createLazyIdentity(load)
    const listener = vi.fn()

    port.onUserChanged(listener)
    inner.fire(alice)

    expect(load).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
  })

  it.for([
    { phase: 'loading', settle: () => {} },
    { phase: 'active', settle: (release: () => void) => release() }
  ])(
    'reuses the activation while $phase: one load, one inner subscription',
    async ({ settle }) => {
      const { inner, release, load } = deferredLoader()
      const port = createLazyIdentity(load)

      const first = port.activate()
      settle(release)
      await Promise.resolve()
      const second = port.activate()
      release()
      await Promise.all([first, second])

      expect(second).toBe(first)
      expect(load).toHaveBeenCalledOnce()
      expect(inner.subscriptions()).toBe(1)
    }
  )

  it('forwards every inner event to every registered listener once active', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    const early = vi.fn()
    const late = vi.fn()
    port.onUserChanged(early)
    release()
    await port.activate()
    port.onUserChanged(late)

    inner.fire(alice)
    inner.fire(null)

    expect(early.mock.calls).toEqual([[alice], [null]])
    expect(late.mock.calls).toEqual([[alice], [null]])
  })

  it('replays the last delivered user to a listener that registers after delivery', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    release()
    await port.activate()
    inner.fire(alice)
    inner.fire(bob)
    const listener = vi.fn()

    port.onUserChanged(listener)

    expect(
      listener.mock.calls,
      'the Firebase port replays the current user on subscribe, so the lazy port must too'
    ).toEqual([[bob]])
  })

  it.for([
    { phase: 'inactive', reach: async () => {}, delivered: [] },
    {
      phase: 'loading',
      reach: async (port: LazyIdentity<AccountUser>) => {
        void port.activate()
      },
      delivered: []
    },
    {
      phase: 'active',
      reach: async (port: LazyIdentity<AccountUser>, release: () => void) => {
        release()
        await port.activate()
      },
      delivered: [[null]]
    }
  ])(
    'deactivate while $phase leaves the inner identity unsubscribed and delivers $delivered',
    async ({ reach, delivered }) => {
      const { inner, release, load } = deferredLoader()
      const port = createLazyIdentity(load)
      const listener = vi.fn()
      port.onUserChanged(listener)
      await reach(port, release)

      port.deactivate()
      release()
      await Promise.resolve()
      await Promise.resolve()
      inner.fire(alice)

      expect(inner.subscribed()).toBe(0)
      expect(listener.mock.calls).toEqual(delivered)
    }
  )

  it('re-activation after deactivate subscribes the inner identity again', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    const listener = vi.fn()
    port.onUserChanged(listener)
    release()
    await port.activate()
    inner.fire(alice)
    port.deactivate()

    await port.activate()
    inner.fire(bob)

    expect(inner.subscriptions()).toBe(2)
    expect(listener.mock.calls).toEqual([[alice], [null], [bob]])
  })

  it('does not replay a user from before deactivation to a later listener', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    release()
    await port.activate()
    inner.fire(alice)
    port.deactivate()
    const listener = vi.fn()

    port.onUserChanged(listener)

    expect(listener).not.toHaveBeenCalled()
  })

  it('rejects when the loader rejects and lets a later activation retry', async () => {
    const inner = innerIdentity()
    const load = vi
      .fn<() => Promise<AccountIdentity>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValue(inner.identity)
    const port = createLazyIdentity(load)

    await expect(port.activate()).rejects.toThrow('chunk failed')
    await port.activate()

    expect(load).toHaveBeenCalledTimes(2)
    expect(inner.subscribed()).toBe(1)
  })

  it('stops delivering to a listener that unsubscribed and tolerates deactivate afterwards', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    const listener = vi.fn()
    const unsubscribe = port.onUserChanged(listener)
    release()
    await port.activate()

    unsubscribe()
    inner.fire(alice)
    port.deactivate()

    expect(listener).not.toHaveBeenCalled()
    expect(inner.subscribed()).toBe(0)
  })

  it('is accepted by createSessionClient, which stays pending until activation delivers', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    const client = createSessionClient(
      { exchangeUrl: 'https://example.test/token', storage: noopStorage },
      port
    )

    expect(client.getSnapshot().phase).toBe('pending')
    release()
    await port.activate()
    inner.fire(null)

    expect(client.getSnapshot().phase).toBe('signed-out')
  })
})
