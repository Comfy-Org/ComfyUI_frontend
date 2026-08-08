/**
 * A signal that aborts when the page is discarded — navigation away, tab or
 * window close, or a mobile discard. Requests the browser cancels at teardown
 * reject with a generic `TypeError: Failed to fetch`, indistinguishable from a
 * real network fault; aborting them as the page goes lets a caller recognise
 * the ordinary page exit instead.
 *
 * `pagehide` rather than `beforeunload`, which also fires for navigations the
 * user then cancels. A persisted `pagehide` is a back/forward-cache freeze
 * rather than a discard — the page resumes, so its requests are left alone.
 * The controller is re-minted on `pageshow` so a page a browser restores after
 * reporting a discard is not left with a spent signal.
 */
let controller = new AbortController()

function abortInFlightRequests(event: PageTransitionEvent) {
  if (event.persisted) return
  controller.abort()
}

function rearmAfterRestore() {
  if (controller.signal.aborted) controller = new AbortController()
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', abortInFlightRequests)
  window.addEventListener('pageshow', rearmAfterRestore)
}

export function pageTeardownSignal(): AbortSignal {
  return controller.signal
}
