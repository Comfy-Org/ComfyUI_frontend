/**
 * An early "the visitor closed the provider window" signal for popup sign-in.
 *
 * Firebase's popup operation notices a closed window on a 2s poll and then
 * waits a further hardcoded 8s before rejecting with
 * `auth/popup-closed-by-user`, so `signInWithPopup` stays pending for 8-10s
 * after the window is gone and any control bound to that promise stays
 * disabled for the whole window. Neither delay is configurable and the SDK
 * exposes no hook for the popup it owns, so this observes the same window
 * directly: `signInWithPopup` opens it with `window.open`, which is patched
 * for the span of the call to capture the handle and restored as soon as one
 * arrives.
 *
 * The signal is advisory. `run`'s promise is returned untouched and stays
 * authoritative for the outcome, so a caller that releases its controls early
 * can still let a late success through and drop a late rejection.
 *
 * Two routes are deliberately not covered, and on both the caller simply
 * keeps Firebase's own timing. An installed PWA on iOS opens the provider in
 * a new tab through a synthetic anchor click rather than `window.open`, so
 * nothing is captured — but Firebase holds no window handle there either and
 * never raises `popup-closed-by-user`, so there is no delay to shorten. The
 * auth emulator serves `emulator/auth/handler`, which this does not match.
 */

/** Far below Firebase's own 2s poll, and cheap: one `closed` read per tick. */
const POPUP_CLOSE_POLL_MS = 250

/**
 * Firebase always points its popup at the auth handler on the configured auth
 * domain. Matching it means an unrelated `window.open` from elsewhere on the
 * page during the call is ignored rather than watched in its place; if the SDK
 * ever stops using this route, nothing matches and the wait simply falls back
 * to Firebase's own timing.
 */
const FIREBASE_AUTH_HANDLER_PATH = '/__/auth/handler'

/**
 * A closed window is not proof of abandonment — on some flows the OAuth
 * helper closes the popup itself once it has handed the credential back — so
 * a sign-in that is already resolving is given this long to settle first and
 * suppress the signal entirely.
 */
const POPUP_CLOSE_SETTLE_MS = 500

let patchInstalled = false

/**
 * Runs `run` and calls `onPopupClosed` at most once, shortly after the popup
 * it opened is closed without the sign-in having settled. Never fires once
 * `run` has settled, and never fires at all when no popup was captured (a
 * blocked popup already rejects promptly on its own).
 */
export function withPopupCloseSignal<T>(
  run: () => Promise<T>,
  onPopupClosed: () => void
): Promise<T> {
  // Nesting would capture the outer patch as the inner one's "native" and
  // leave a dead closure installed on the page, so the second caller simply
  // goes unwatched. Firebase runs one popup at a time regardless.
  if (typeof window === 'undefined' || patchInstalled) return run()

  const nativeOpen = window.open
  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const restoreOpen = () => {
    // Only the installer clears the flag: a call that never patched must not
    // hand the next one permission to wrap a patch that is still live.
    if (window.open !== patchedOpen) return
    window.open = nativeOpen
    patchInstalled = false
  }

  const watchForClose = (popup: Window) => {
    const poll = () => {
      if (settled) return
      if (!popup.closed) {
        timer = setTimeout(poll, POPUP_CLOSE_POLL_MS)
        return
      }
      timer = setTimeout(() => {
        if (settled) return
        settled = true
        onPopupClosed()
      }, POPUP_CLOSE_SETTLE_MS)
    }
    timer = setTimeout(poll, POPUP_CLOSE_POLL_MS)
  }

  const patchedOpen: typeof window.open = (...args) => {
    const opened = nativeOpen.apply(window, args)
    if (!String(args[0] ?? '').includes(FIREBASE_AUTH_HANDLER_PATH)) {
      return opened
    }
    restoreOpen()
    if (opened) watchForClose(opened)
    return opened
  }

  const stopWatching = () => {
    settled = true
    restoreOpen()
    clearTimeout(timer)
  }

  window.open = patchedOpen
  patchInstalled = true
  // The popup is opened several awaits into `signInWithPopup` (the resolver
  // initializes first), so the patch has to outlive the synchronous call — and
  // has to come off again when that call throws before ever opening one.
  try {
    return run().finally(stopWatching)
  } catch (error) {
    stopWatching()
    throw error
  }
}
