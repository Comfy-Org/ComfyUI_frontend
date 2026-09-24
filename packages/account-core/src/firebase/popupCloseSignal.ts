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
 */

/** Far below Firebase's own 2s poll, and cheap: one `closed` read per tick. */
const POPUP_CLOSE_POLL_MS = 250

/**
 * A closed window is not proof of abandonment — on some flows the OAuth
 * helper closes the popup itself once it has handed the credential back — so
 * a sign-in that is already resolving is given this long to settle first and
 * suppress the signal entirely.
 */
const POPUP_CLOSE_SETTLE_MS = 500

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
  if (typeof window === 'undefined') return run()

  const nativeOpen = window.open
  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const restoreOpen = () => {
    if (window.open === patchedOpen) window.open = nativeOpen
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

  // Only the first window opened during the call is Firebase's, and the patch
  // comes off the moment it arrives, so nothing else on the page is observed.
  const patchedOpen: typeof window.open = (...args) => {
    const opened = nativeOpen.apply(window, args)
    restoreOpen()
    if (opened) watchForClose(opened)
    return opened
  }

  window.open = patchedOpen
  // The popup is opened several awaits into `signInWithPopup` (the resolver
  // initializes first), so the patch has to outlive the synchronous call.
  return run().finally(() => {
    settled = true
    restoreOpen()
    clearTimeout(timer)
  })
}
