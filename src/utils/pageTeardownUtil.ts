/**
 * A signal that aborts when the page goes away — navigation, tab close, or a
 * mobile discard. Requests the browser cancels at teardown reject with a
 * generic `TypeError: Failed to fetch`, indistinguishable from a real network
 * fault; aborting them as the page hides lets a caller recognise the ordinary
 * page exit instead.
 *
 * `pagehide` rather than `beforeunload`, which also fires for navigations the
 * user then cancels — nothing should be aborted while the page keeps running.
 * A hidden page can still come back from the back/forward cache, so the
 * controller is replaced after each abort rather than latching.
 */
let controller = new AbortController()

function abortInFlightRequests() {
  controller.abort()
  controller = new AbortController()
}

window.addEventListener('pagehide', abortInFlightRequests)

export function pageTeardownSignal(): AbortSignal {
  return controller.signal
}
