import type { Mock } from 'vitest'
import { describe, expect, it, vi } from 'vitest'

import { createTestIdentity } from '../testing.js'
import type { AccountIdentity } from './identity.js'
import type { LazyIdentity } from './lazyIdentity.js'
import {
  createLazyIdentity,
  createUnavailableIdentity
} from './lazyIdentity.js'
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
    subscribed: () => callbacks.size,
    whenSubscribed: () =>
      vi.waitFor(() => expect(callbacks.size).toBeGreaterThan(0))
  }
}

function leakyIdentity() {
  const callbacks = new Set<(user: AccountUser | null) => void>()
  let subscriptions = 0
  const identity = createTestIdentity<AccountUser>({
    onUserChanged: (callback) => {
      subscriptions += 1
      callbacks.add(callback)
      return () => undefined
    }
  })
  return {
    identity,
    fire: (user: AccountUser | null) =>
      callbacks.forEach((callback) => callback(user)),
    subscriptions: () => subscriptions,
    whenSubscribed: () =>
      vi.waitFor(() => expect(callbacks.size).toBeGreaterThan(0))
  }
}

type Inner = ReturnType<typeof innerIdentity>

function deferredLoader() {
  const inner = innerIdentity()
  let release!: () => void
  const loaded = new Promise<typeof inner.identity>((resolve) => {
    release = () => resolve(inner.identity)
  })
  return { inner, release, load: vi.fn(() => loaded) }
}

async function activated(
  port: LazyIdentity<AccountUser>,
  release: () => void,
  inner: Inner,
  user: AccountUser | null
): Promise<void> {
  const activation = port.activate()
  release()
  await inner.whenSubscribed()
  inner.fire(user)
  await activation
}

function settledFlag(promise: Promise<void>) {
  let settled = false
  void promise.then(() => {
    settled = true
  })
  return () => settled
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

  it('keeps the activation pending until the inner identity delivers, then resolves', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)

    const activation = port.activate()
    const isSettled = settledFlag(activation)
    release()
    await inner.whenSubscribed()
    await Promise.resolve()

    expect(
      isSettled(),
      'a subscribed but silent identity has not answered yet'
    ).toBe(false)
    inner.fire(alice)
    await activation
  })

  it.for([
    { phase: 'loading', settle: async () => {} },
    {
      phase: 'awaiting the first delivery',
      settle: async (release: () => void, inner: Inner) => {
        release()
        await inner.whenSubscribed()
      }
    },
    {
      phase: 'active',
      settle: async (release: () => void, inner: Inner) => {
        release()
        await inner.whenSubscribed()
        inner.fire(alice)
      }
    }
  ])(
    'reuses the activation while $phase: one load, one inner subscription',
    async ({ settle }) => {
      const { inner, release, load } = deferredLoader()
      const port = createLazyIdentity(load)

      const first = port.activate()
      await settle(release, inner)
      const second = port.activate()
      release()
      await inner.whenSubscribed()
      inner.fire(alice)
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
    await activated(port, release, inner, alice)
    port.onUserChanged(late)

    inner.fire(bob)
    inner.fire(null)

    expect(early.mock.calls).toEqual([[alice], [bob], [null]])
    expect(late.mock.calls).toEqual([[alice], [bob], [null]])
  })

  it('replays the last delivered user to a listener that registers after delivery', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    await activated(port, release, inner, alice)
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
      phase: 'awaiting the first delivery',
      reach: async (
        port: LazyIdentity<AccountUser>,
        release: () => void,
        inner: Inner
      ) => {
        void port.activate()
        release()
        await inner.whenSubscribed()
      },
      delivered: []
    },
    {
      phase: 'active',
      reach: async (
        port: LazyIdentity<AccountUser>,
        release: () => void,
        inner: Inner
      ) => {
        await activated(port, release, inner, alice)
      },
      delivered: [[alice], [null]]
    }
  ])(
    'deactivate while $phase leaves the inner identity unsubscribed and delivers $delivered',
    async ({ reach, delivered }) => {
      const { inner, release, load } = deferredLoader()
      const port = createLazyIdentity(load)
      const listener = vi.fn()
      port.onUserChanged(listener)
      await reach(port, release, inner)

      port.deactivate()
      release()
      await Promise.resolve()
      await Promise.resolve()
      inner.fire(bob)

      expect(inner.subscribed()).toBe(0)
      expect(listener.mock.calls).toEqual(delivered)
    }
  )

  it('resolves an activation that deactivate interrupts before the first delivery', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    const activation = port.activate()
    release()
    await inner.whenSubscribed()

    port.deactivate()

    await expect(
      activation,
      'the host re-checks liveness after the await, so an interrupted activation resolves'
    ).resolves.toBeUndefined()
  })

  it('re-activation after deactivate subscribes the inner identity again', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    const listener = vi.fn()
    port.onUserChanged(listener)
    await activated(port, release, inner, alice)
    port.deactivate()

    await activated(port, release, inner, bob)

    expect(inner.subscriptions()).toBe(2)
    expect(listener.mock.calls).toEqual([[alice], [null], [bob]])
  })

  it('does not replay a user from before deactivation to a later listener', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    await activated(port, release, inner, alice)
    port.deactivate()
    const listener = vi.fn()

    port.onUserChanged(listener)

    expect(listener).not.toHaveBeenCalled()
  })

  it.for([
    {
      failure: 'the loader rejects',
      failOnce: (load: Mock<() => Promise<AccountIdentity>>) =>
        load.mockRejectedValueOnce(new Error('chunk failed'))
    },
    {
      failure: 'the loader throws synchronously',
      failOnce: (load: Mock<() => Promise<AccountIdentity>>) =>
        load.mockImplementationOnce(() => {
          throw new Error('chunk failed')
        })
    },
    {
      failure: 'the loaded identity throws on subscribe',
      failOnce: (load: Mock<() => Promise<AccountIdentity>>) =>
        load.mockResolvedValueOnce(
          createTestIdentity<AccountUser>({
            onUserChanged: () => {
              throw new Error('chunk failed')
            }
          })
        )
    }
  ])(
    'rejects when $failure and lets a later activation retry',
    async ({ failOnce }) => {
      const inner = innerIdentity()
      const load = vi.fn<() => Promise<AccountIdentity>>()
      failOnce(load).mockResolvedValue(inner.identity)
      const port = createLazyIdentity(load)

      await expect(port.activate()).rejects.toThrow('chunk failed')
      const retry = port.activate()
      await inner.whenSubscribed()
      inner.fire(null)
      await retry

      expect(load).toHaveBeenCalledTimes(2)
      expect(inner.subscribed()).toBe(1)
    }
  )

  it('resolves the activation even when a listener throws on the first delivery', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    port.onUserChanged(() => {
      throw new Error('listener failed')
    })
    const activation = port.activate()
    release()
    await inner.whenSubscribed()

    expect(() => inner.fire(alice)).toThrow('listener failed')

    await expect(activation).resolves.toBeUndefined()
  })

  it('stops delivering to a listener that unsubscribed and tolerates deactivate afterwards', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    const listener = vi.fn()
    const unsubscribe = port.onUserChanged(listener)
    unsubscribe()
    await activated(port, release, inner, alice)

    inner.fire(bob)
    port.deactivate()

    expect(listener).not.toHaveBeenCalled()
    expect(inner.subscribed()).toBe(0)
  })

  it('drops a loader rejection that lands after deactivate; the interrupted activation stays resolved', async () => {
    let fail!: (error: Error) => void
    const load = vi.fn(
      () =>
        new Promise<AccountIdentity>((_resolve, reject) => {
          fail = reject
        })
    )
    const port = createLazyIdentity(load)
    const activation = port.activate()

    port.deactivate()
    fail(new Error('chunk failed'))

    await expect(activation).resolves.toBeUndefined()
  })

  it('subscribes once when a re-activation shares the interrupted load promise', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    const listener = vi.fn()
    port.onUserChanged(listener)
    void port.activate()
    port.deactivate()

    const second = port.activate()
    release()
    await inner.whenSubscribed()
    inner.fire(alice)
    await second

    expect(load).toHaveBeenCalledTimes(2)
    expect(
      inner.subscriptions(),
      'a cached import() resolves both activations with one identity; only the live one may subscribe'
    ).toBe(1)
    expect(listener.mock.calls).toEqual([[alice]])
  })

  it('treats a second consecutive deactivate as a no-op', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    const listener = vi.fn()
    port.onUserChanged(listener)
    await activated(port, release, inner, alice)

    port.deactivate()
    port.deactivate()

    expect(listener.mock.calls).toEqual([[alice], [null]])
  })

  it('ignores an event from a subscription the inner identity failed to release after deactivate', async () => {
    const leaky = leakyIdentity()
    const port = createLazyIdentity(async () => leaky.identity)
    const listener = vi.fn()
    port.onUserChanged(listener)
    const activation = port.activate()
    await leaky.whenSubscribed()
    leaky.fire(alice)
    await activation

    port.deactivate()
    leaky.fire(bob)

    expect(listener.mock.calls).toEqual([[alice], [null]])
  })

  it('ignores a late event from the previous generation after re-activation', async () => {
    const leaky = leakyIdentity()
    const port = createLazyIdentity(async () => leaky.identity)
    const listener = vi.fn()
    port.onUserChanged(listener)
    const first = port.activate()
    await leaky.whenSubscribed()
    leaky.fire(alice)
    await first
    port.deactivate()
    const second = port.activate()
    await vi.waitFor(() => expect(leaky.subscriptions()).toBe(2))

    leaky.fire(bob)
    await second

    expect(
      listener.mock.calls,
      'the stale first-generation subscription must not deliver bob a second time'
    ).toEqual([[alice], [null], [bob]])
  })

  it('delivers nothing on deactivate after a delivered null', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    const listener = vi.fn()
    port.onUserChanged(listener)
    await activated(port, release, inner, null)

    port.deactivate()

    expect(listener.mock.calls).toEqual([[null]])
  })

  it('is accepted by createSessionClient, which stays pending until activation delivers', async () => {
    const { inner, release, load } = deferredLoader()
    const port = createLazyIdentity(load)
    const client = createSessionClient(
      { exchangeUrl: 'https://example.test/token', storage: noopStorage },
      port
    )
    const activation = port.activate()
    release()
    await inner.whenSubscribed()

    expect(client.getSnapshot().phase).toBe('pending')
    inner.fire(null)
    await activation

    expect(client.getSnapshot().phase).toBe('signed-out')
  })
})

describe('createUnavailableIdentity', () => {
  it('delivers null once to every subscriber, synchronously', () => {
    const identity = createUnavailableIdentity<AccountUser>()
    const listener = vi.fn()

    identity.onUserChanged(listener)

    expect(listener).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('settles a session client to signed-out without a pending wait', async () => {
    const identity = createUnavailableIdentity<AccountUser>()
    const client = createSessionClient(
      { exchangeUrl: 'https://example.test/token', storage: noopStorage },
      identity
    )

    expect(client.getSnapshot().phase).toBe('signed-out')
  })
})
