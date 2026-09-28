import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PopupWatchCallbacks } from './popupWatch.js'

/**
 * Firebase's resolver as the SDK drives it: `_initialize` hands back the
 * event manager every popup result is delivered through, and `_openPopup`
 * opens the window for one operation's provider and event id.
 */
const sdk = vi.hoisted(() => {
  const state: {
    manager: { onEvent: (event: unknown) => boolean } | Record<string, never>
    windows: Array<{ closed: boolean } | null>
  } = { manager: { onEvent: () => true }, windows: [] }
  class BrowserPopupRedirectResolver {
    async _initialize(_auth: unknown) {
      return state.manager
    }
    async _openPopup(
      _auth: unknown,
      _provider: unknown,
      _authType: unknown,
      _eventId?: string
    ) {
      return { window: state.windows.shift() ?? null }
    }
  }
  return { state, BrowserPopupRedirectResolver }
})

vi.mock<unknown>(import('firebase/auth'), () => ({
  browserPopupRedirectResolver: sdk.BrowserPopupRedirectResolver
}))

interface ResolverUnderTest {
  _initialize: (auth: unknown) => Promise<{
    onEvent: (event: unknown) => boolean
  }>
  _openPopup: (
    auth: unknown,
    provider: unknown,
    authType: string,
    eventId?: string
  ) => Promise<unknown>
}

const result = (eventId: string) => ({ type: 'signInViaPopup', eventId })

let firebaseOnEvent: ReturnType<typeof vi.fn<(event: unknown) => boolean>>

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  firebaseOnEvent = vi.fn<(event: unknown) => boolean>(() => true)
  sdk.state.manager = { onEvent: firebaseOnEvent }
  sdk.state.windows = []
})

async function load() {
  const watch = await import('./popupWatch.js')
  const Resolver =
    watch.watchedPopupRedirectResolver as unknown as new () => ResolverUnderTest
  const resolver = new Resolver()
  const auth = {}
  // Firebase initializes the resolver before it opens any popup.
  const manager = await resolver._initialize(auth)
  return { ...watch, resolver, manager, auth }
}

/**
 * One popup sign-in as `signInWithPopup` drives it: the popup opens for the
 * operation's provider and event id, then the call settles when the test
 * says. `open: false` leaves the popup unopened, for a test to open later.
 */
async function startSignIn(
  loaded: Awaited<ReturnType<typeof load>>,
  eventId: string,
  callbacks?: PopupWatchCallbacks,
  { open = true } = {}
) {
  const provider = {}
  const popupWindow = { closed: false }
  let settle!: {
    resolve: (value: string) => void
    reject: (e: unknown) => void
  }
  const openPopup = async () => {
    sdk.state.windows.push(popupWindow)
    await loaded.resolver._openPopup(
      loaded.auth,
      provider,
      'signInViaPopup',
      eventId
    )
  }
  const outcome = loaded.runWatchedPopup(
    provider,
    async () => {
      if (open) await openPopup()
      return new Promise<string>((resolve, reject) => {
        settle = { resolve, reject }
      })
    },
    callbacks ?? {}
  )
  await vi.advanceTimersByTimeAsync(0)
  return {
    outcome,
    openPopup,
    close: () => {
      popupWindow.closed = true
    },
    settle: () => settle
  }
}

describe('runWatchedPopup', () => {
  it('reports an abandoned popup as soon as its window closes with no result', async () => {
    const onAbandoned = vi.fn()
    const popup = await startSignIn(await load(), 'e1', { onAbandoned })

    await vi.advanceTimersByTimeAsync(500)
    expect(onAbandoned).not.toHaveBeenCalled()

    popup.close()
    await vi.advanceTimersByTimeAsync(100)
    expect(onAbandoned).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(10_000)
    expect(onAbandoned).toHaveBeenCalledOnce()
  })

  it('never reports abandonment once the result has reached the page, however long the sign-in then takes', async () => {
    const onAbandoned = vi.fn()
    const loaded = await load()
    const popup = await startSignIn(loaded, 'e1', { onAbandoned })

    loaded.manager.onEvent(result('e1'))
    popup.close()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(onAbandoned).not.toHaveBeenCalled()
  })

  it('hands every result to Firebase and passes its answer back', async () => {
    const loaded = await load()
    await startSignIn(loaded, 'e1', { onAbandoned: vi.fn() })
    firebaseOnEvent.mockReturnValueOnce(false)

    expect(loaded.manager.onEvent(result('e1'))).toBe(false)
    expect(firebaseOnEvent).toHaveBeenCalledWith(result('e1'))
  })

  it('does not mistake Firebase start-up events for a sign-in result', async () => {
    const onAbandoned = vi.fn()
    const loaded = await load()
    const popup = await startSignIn(loaded, 'e1', { onAbandoned })

    const startUp = { type: 'unknown', eventId: 'e1' }
    loaded.manager.onEvent(startUp)
    expect(firebaseOnEvent).toHaveBeenCalledWith(startUp)

    popup.close()
    await vi.advanceTimersByTimeAsync(100)
    expect(onAbandoned).toHaveBeenCalledOnce()
  })

  it('does not credit another operation’s result to this popup', async () => {
    const onAbandoned = vi.fn()
    const loaded = await load()
    const popup = await startSignIn(loaded, 'e1', { onAbandoned })

    loaded.manager.onEvent(result('someone-else'))
    popup.close()
    await vi.advanceTimersByTimeAsync(100)

    expect(onAbandoned).toHaveBeenCalledOnce()
  })

  it('discards a late result before Firebase can use it when the caller says so', async () => {
    const onResumed = vi.fn()
    const loaded = await load()
    const popup = await startSignIn(loaded, 'e1', {
      onAbandoned: vi.fn(),
      onResumed,
      discardLateResult: () => true
    })
    popup.close()
    await vi.advanceTimersByTimeAsync(100)

    // Acknowledged, so Firebase's handler page stops, but never delivered,
    // so no token exchange runs and no account is signed in.
    expect(loaded.manager.onEvent(result('e1'))).toBe(true)
    expect(firebaseOnEvent).not.toHaveBeenCalled()
    expect(onResumed).not.toHaveBeenCalled()
  })

  it('resumes a kept late result once, before Firebase starts using it, however often it is delivered', async () => {
    const order: string[] = []
    firebaseOnEvent.mockImplementation(() => {
      order.push('firebase')
      return true
    })
    const loaded = await load()
    const popup = await startSignIn(loaded, 'e1', {
      onAbandoned: vi.fn(),
      onResumed: () => order.push('resumed'),
      discardLateResult: () => false
    })
    popup.close()
    await vi.advanceTimersByTimeAsync(100)

    loaded.manager.onEvent(result('e1'))
    loaded.manager.onEvent(result('e1'))

    expect(order).toEqual(['resumed', 'firebase', 'firebase'])
  })

  it('lets a late failure through untouched instead of resuming it as a sign-in', async () => {
    const onResumed = vi.fn()
    const loaded = await load()
    const popup = await startSignIn(loaded, 'e1', {
      onAbandoned: vi.fn(),
      onResumed,
      discardLateResult: () => false
    })
    popup.close()
    await vi.advanceTimersByTimeAsync(100)

    const failure = { ...result('e1'), error: { code: 'auth/user-cancelled' } }
    loaded.manager.onEvent(failure)

    expect(onResumed).not.toHaveBeenCalled()
    expect(firebaseOnEvent).toHaveBeenCalledWith(failure)
  })

  it('discards a late result when the caller’s check throws, never delivering it', async () => {
    const loaded = await load()
    const popup = await startSignIn(loaded, 'e1', {
      onAbandoned: vi.fn(),
      discardLateResult: () => {
        throw new Error('host bug')
      }
    })
    popup.close()
    await vi.advanceTimersByTimeAsync(100)

    expect(loaded.manager.onEvent(result('e1'))).toBe(true)
    expect(firebaseOnEvent).not.toHaveBeenCalled()
  })

  it('still hands a kept late result to Firebase when the caller’s resume throws', async () => {
    const loaded = await load()
    const popup = await startSignIn(loaded, 'e1', {
      onAbandoned: vi.fn(),
      discardLateResult: () => false,
      onResumed: () => {
        throw new Error('host bug')
      }
    })
    popup.close()
    await vi.advanceTimersByTimeAsync(100)

    loaded.manager.onEvent(result('e1'))

    expect(firebaseOnEvent).toHaveBeenCalledWith(result('e1'))
  })

  it('watches only the latest window when one sign-in opens a popup twice', async () => {
    const onAbandoned = vi.fn()
    const loaded = await load()
    const provider = {}
    const first = { closed: false }
    const second = { closed: false }
    sdk.state.windows.push(first, second)
    void loaded.runWatchedPopup(
      provider,
      async () => {
        await loaded.resolver._openPopup(
          loaded.auth,
          provider,
          'signInViaPopup',
          'e1'
        )
        await loaded.resolver._openPopup(
          loaded.auth,
          provider,
          'signInViaPopup',
          'e2'
        )
        return new Promise(() => {})
      },
      { onAbandoned, discardLateResult: () => true }
    )
    await vi.advanceTimersByTimeAsync(0)

    first.closed = true
    await vi.advanceTimersByTimeAsync(500)
    expect(
      onAbandoned,
      'the replaced window is no longer watched'
    ).not.toHaveBeenCalled()

    second.closed = true
    await vi.advanceTimersByTimeAsync(100)
    expect(onAbandoned).toHaveBeenCalledOnce()

    loaded.manager.onEvent(result('e1'))
    expect(
      firebaseOnEvent,
      'the replaced popup’s event id is Firebase’s again'
    ).toHaveBeenCalledWith(result('e1'))
  })

  it('does not watch popups for an Auth whose results it cannot see, even when it sees another Auth’s', async () => {
    const onAbandoned = vi.fn()
    const loaded = await load()
    sdk.state.manager = {}
    const otherAuth = {}
    await loaded.resolver._initialize(otherAuth)
    const provider = {}
    const otherWindow = { closed: false }
    sdk.state.windows.push(otherWindow)
    void loaded.runWatchedPopup(
      provider,
      async () => {
        await loaded.resolver._openPopup(
          otherAuth,
          provider,
          'signInViaPopup',
          'e9'
        )
        return new Promise(() => {})
      },
      { onAbandoned }
    )
    await vi.advanceTimersByTimeAsync(0)

    otherWindow.closed = true
    await vi.advanceTimersByTimeAsync(500)

    expect(onAbandoned).not.toHaveBeenCalled()
  })

  it('watches each popup for its own sign-in when a second starts before the first opens its window', async () => {
    // Firebase cancels the first operation when the second starts, yet still
    // opens the first one's window once its resolver is ready.
    const first = vi.fn()
    const second = vi.fn()
    const loaded = await load()
    const a = await startSignIn(
      loaded,
      'e1',
      { onAbandoned: first },
      { open: false }
    )
    const b = await startSignIn(
      loaded,
      'e2',
      { onAbandoned: second },
      { open: false }
    )
    a.settle().reject({ code: 'auth/cancelled-popup-request' })
    await expect(a.outcome).rejects.toMatchObject({
      code: 'auth/cancelled-popup-request'
    })

    await a.openPopup()
    await b.openPopup()
    a.close()
    await vi.advanceTimersByTimeAsync(500)
    expect(
      second,
      'the stray first window is not this sign-in'
    ).not.toHaveBeenCalled()

    b.close()
    await vi.advanceTimersByTimeAsync(100)
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
  })

  it('keeps watching the live popup when Firebase opens the cancelled one’s window after it', async () => {
    const live = vi.fn()
    const loaded = await load()
    const cancelled = await startSignIn(
      loaded,
      'e1',
      { onAbandoned: vi.fn() },
      { open: false }
    )
    const current = await startSignIn(
      loaded,
      'e2',
      { onAbandoned: live },
      { open: false }
    )
    cancelled.settle().reject({ code: 'auth/cancelled-popup-request' })
    await expect(cancelled.outcome).rejects.toBeTruthy()

    await current.openPopup()
    await cancelled.openPopup()
    cancelled.close()
    await vi.advanceTimersByTimeAsync(500)
    expect(
      live,
      'the stray window opened last is not this sign-in'
    ).not.toHaveBeenCalled()

    current.close()
    await vi.advanceTimersByTimeAsync(100)
    expect(live).toHaveBeenCalledOnce()
  })

  it('watches a retry started right after a closed popup', async () => {
    const retry = vi.fn()
    const loaded = await load()
    const first = await startSignIn(loaded, 'e1', { onAbandoned: vi.fn() })
    first.close()
    await vi.advanceTimersByTimeAsync(100)

    const second = await startSignIn(loaded, 'e2', { onAbandoned: retry })
    first.settle().reject({ code: 'auth/cancelled-popup-request' })
    await expect(first.outcome).rejects.toBeTruthy()
    second.close()
    await vi.advanceTimersByTimeAsync(100)

    expect(retry).toHaveBeenCalledOnce()
  })

  it('stops watching once the sign-in settles', async () => {
    const onAbandoned = vi.fn()
    const loaded = await load()
    const popup = await startSignIn(loaded, 'e1', { onAbandoned })

    popup.settle().resolve('signed-in')
    await expect(popup.outcome).resolves.toBe('signed-in')
    popup.close()
    await vi.advanceTimersByTimeAsync(1000)
    loaded.manager.onEvent(result('e1'))

    expect(onAbandoned).not.toHaveBeenCalled()
    expect(firebaseOnEvent).toHaveBeenCalledWith(result('e1'))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('forgets a closed popup once its sign-in settles, so its event id is Firebase’s again', async () => {
    const loaded = await load()
    const popup = await startSignIn(loaded, 'e1', {
      onAbandoned: vi.fn(),
      discardLateResult: () => true
    })
    popup.close()
    await vi.advanceTimersByTimeAsync(100)

    popup.settle().reject({ code: 'auth/popup-closed-by-user' })
    await expect(popup.outcome).rejects.toBeTruthy()
    loaded.manager.onEvent(result('e1'))

    expect(firebaseOnEvent).toHaveBeenCalledWith(result('e1'))
  })

  it('stops watching when the sign-in fails', async () => {
    const popup = await startSignIn(await load(), 'e1', {
      onAbandoned: vi.fn()
    })

    popup.settle().reject(new Error('denied'))
    await expect(popup.outcome).rejects.toThrow('denied')

    expect(vi.getTimerCount()).toBe(0)
  })

  it('falls back to Firebase’s own timing when results cannot be observed', async () => {
    // A Firebase release that changes its event manager: without a way to see
    // results, a closed window proves nothing, so nothing is reported.
    sdk.state.manager = {}
    const onAbandoned = vi.fn()
    const popup = await startSignIn(await load(), 'e1', { onAbandoned })

    popup.close()
    await vi.advanceTimersByTimeAsync(1000)

    expect(onAbandoned).not.toHaveBeenCalled()
  })

  it('watches nothing when the provider opens no window it can see', async () => {
    // An installed iOS web app opens the provider in a tab, not a popup.
    const loaded = await load()
    const onAbandoned = vi.fn()
    const provider = {}
    await loaded.runWatchedPopup(
      provider,
      async () => {
        await loaded.resolver._openPopup(
          loaded.auth,
          provider,
          'signInViaPopup',
          'e1'
        )
      },
      { onAbandoned }
    )

    expect(vi.getTimerCount()).toBe(0)
    expect(onAbandoned).not.toHaveBeenCalled()
  })

  it('wraps each event manager once, however many sign-ins initialize it', async () => {
    const loaded = await load()
    const wrapped = loaded.manager.onEvent
    await loaded.resolver._initialize(loaded.auth)

    expect(loaded.manager.onEvent).toBe(wrapped)
  })
})
