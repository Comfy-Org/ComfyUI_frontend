import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { withPopupCloseSignal } from './popupCloseSignal.js'

/** One poll tick plus the settle window, the soonest the signal can fire. */
const AFTER_CLOSE_MS = 750

interface SignInHarness {
  readonly settle: (credential: string) => void
  readonly fail: (error: Error) => void
  readonly signedIn: Promise<string>
}

function pendingSignIn(): SignInHarness {
  let settle = (_credential: string) => {}
  let fail = (_error: Error) => {}
  const signedIn = new Promise<string>((resolve, reject) => {
    settle = resolve
    fail = reject
  })
  return {
    settle: (credential) => settle(credential),
    fail: (error) => fail(error),
    signedIn
  }
}

let popupCount = 0

const AUTH_HANDLER_URL =
  'https://example.firebaseapp.com/__/auth/handler?providerId=google.com'

/** A real popup window, the way `signInWithPopup` opens one: at the auth
 *  handler, several awaits into the call, never synchronously with it. */
async function openPopupLate(url = AUTH_HANDLER_URL): Promise<Window> {
  await Promise.resolve()
  const popup = window.open(url, `popup-${(popupCount += 1)}`, 'width=1')
  if (!popup) throw new Error('happy-dom did not provide a popup window')
  return popup
}

describe('withPopupCloseSignal', () => {
  let nativeOpen: typeof window.open

  beforeEach(() => {
    nativeOpen = window.open
  })

  afterEach(() => {
    window.open = nativeOpen
  })

  it('signals once the visitor closes the popup', async () => {
    const onPopupClosed = vi.fn()
    const signIn = pendingSignIn()
    let popup: Window | undefined

    const result = withPopupCloseSignal(async () => {
      popup = await openPopupLate()
      return signIn.signedIn
    }, onPopupClosed)

    await vi.advanceTimersByTimeAsync(AFTER_CLOSE_MS)
    expect(onPopupClosed).not.toHaveBeenCalled()

    popup?.close()
    await vi.advanceTimersByTimeAsync(AFTER_CLOSE_MS)
    expect(onPopupClosed).toHaveBeenCalledOnce()

    signIn.settle('credential')
    await expect(result).resolves.toBe('credential')
  })

  it('signals at most once however long the popup stays closed', async () => {
    const onPopupClosed = vi.fn()
    const signIn = pendingSignIn()
    let popup: Window | undefined

    const result = withPopupCloseSignal(async () => {
      popup = await openPopupLate()
      return signIn.signedIn
    }, onPopupClosed)

    await vi.advanceTimersByTimeAsync(0)
    popup?.close()
    await vi.advanceTimersByTimeAsync(AFTER_CLOSE_MS * 20)

    expect(onPopupClosed).toHaveBeenCalledOnce()
    signIn.settle('credential')
    await result
  })

  it.for([
    {
      outcome: 'resolves',
      settle: (harness: SignInHarness) => harness.settle('credential')
    },
    {
      outcome: 'rejects',
      settle: (harness: SignInHarness) => harness.fail(new Error('denied'))
    }
  ])('stays silent when the sign-in $outcome first', async ({ settle }) => {
    const onPopupClosed = vi.fn()
    const signIn = pendingSignIn()
    let popup: Window | undefined

    const result = withPopupCloseSignal(async () => {
      popup = await openPopupLate()
      return signIn.signedIn
    }, onPopupClosed)
    result.catch(() => {})

    await vi.advanceTimersByTimeAsync(0)
    settle(signIn)
    await vi.advanceTimersByTimeAsync(0)
    popup?.close()
    await vi.advanceTimersByTimeAsync(AFTER_CLOSE_MS * 2)

    expect(onPopupClosed).not.toHaveBeenCalled()
  })

  it('stays silent when the popup closes on a sign-in that then completes', async () => {
    const onPopupClosed = vi.fn()
    const signIn = pendingSignIn()
    let popup: Window | undefined

    const result = withPopupCloseSignal(async () => {
      popup = await openPopupLate()
      return signIn.signedIn
    }, onPopupClosed)

    await vi.advanceTimersByTimeAsync(0)
    popup?.close()
    // Inside the settle window: the OAuth helper closed its own popup and the
    // credential is still on its way.
    await vi.advanceTimersByTimeAsync(300)
    signIn.settle('credential')
    await expect(result).resolves.toBe('credential')

    await vi.advanceTimersByTimeAsync(AFTER_CLOSE_MS * 2)
    expect(onPopupClosed).not.toHaveBeenCalled()
  })

  it('never signals when no popup is opened', async () => {
    const onPopupClosed = vi.fn()

    await expect(
      withPopupCloseSignal(async () => 'credential', onPopupClosed)
    ).resolves.toBe('credential')

    await vi.advanceTimersByTimeAsync(AFTER_CLOSE_MS * 2)
    expect(onPopupClosed).not.toHaveBeenCalled()
  })

  it('propagates the rejection unchanged', async () => {
    const failure = new Error('auth/popup-blocked')

    await expect(
      withPopupCloseSignal(() => Promise.reject(failure), vi.fn())
    ).rejects.toBe(failure)
  })

  it.for([
    {
      scenario: 'the popup is captured',
      run: async () => {
        await openPopupLate()
        return 'credential'
      }
    },
    { scenario: 'no popup is opened', run: async () => 'credential' }
  ])('restores window.open once $scenario', async ({ run }) => {
    const before = window.open

    await withPopupCloseSignal(run, vi.fn())

    expect(window.open).toBe(before)
  })

  it('watches Firebase\u2019s window, not another the page opened meanwhile', async () => {
    const onPopupClosed = vi.fn()
    const signIn = pendingSignIn()
    let unrelatedPopup: Window | undefined
    let firebasePopup: Window | undefined

    const result = withPopupCloseSignal(async () => {
      unrelatedPopup = await openPopupLate('https://example.com/pricing')
      firebasePopup = await openPopupLate()
      return signIn.signedIn
    }, onPopupClosed)

    await vi.advanceTimersByTimeAsync(0)
    unrelatedPopup?.close()
    await vi.advanceTimersByTimeAsync(AFTER_CLOSE_MS * 2)
    expect(
      onPopupClosed,
      'an unrelated window closing says nothing about the sign-in'
    ).not.toHaveBeenCalled()

    firebasePopup?.close()
    await vi.advanceTimersByTimeAsync(AFTER_CLOSE_MS)
    expect(onPopupClosed).toHaveBeenCalledOnce()

    signIn.settle('credential')
    await result
  })

  it('stops observing as soon as the handler window is captured', async () => {
    const onPopupClosed = vi.fn()
    const signIn = pendingSignIn()
    let patchedWhileOpening: boolean | undefined
    let restoredAfterCapture: boolean | undefined
    let laterWindow: Window | undefined

    const result = withPopupCloseSignal(async () => {
      patchedWhileOpening = window.open !== nativeOpen
      await openPopupLate()
      restoredAfterCapture = window.open === nativeOpen
      laterWindow = await openPopupLate()
      return signIn.signedIn
    }, onPopupClosed)

    await vi.advanceTimersByTimeAsync(0)
    expect(
      patchedWhileOpening,
      'the window opens several awaits into the call, so the patch has to outlive it'
    ).toBe(true)
    expect(restoredAfterCapture).toBe(true)

    laterWindow?.close()
    await vi.advanceTimersByTimeAsync(AFTER_CLOSE_MS * 2)
    expect(
      onPopupClosed,
      'only the window this sign-in is waiting on can report its dismissal'
    ).not.toHaveBeenCalled()

    signIn.settle('credential')
    await result
  })

  it('restores window.open when the sign-in throws before opening a window', async () => {
    const before = window.open
    const failure = new Error('firebase config is not loaded')

    expect(() =>
      withPopupCloseSignal(() => {
        throw failure
      }, vi.fn())
    ).toThrow(failure)

    expect(window.open).toBe(before)
  })
})
