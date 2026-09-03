/**
 * Whether the document is being discarded — navigation away, tab or window
 * close, or a mobile discard. Requests the browser cancels at teardown reject
 * with a generic `TypeError: Failed to fetch`, indistinguishable from a real
 * network fault, so the page's own lifecycle is what tells the two apart.
 *
 * `pagehide` rather than `beforeunload`, which also fires for navigations the
 * user then cancels. A persisted `pagehide` is a back/forward-cache freeze
 * rather than a discard — the page resumes — so it does not count, and
 * `pageshow` clears the flag for a page a browser restores after reporting a
 * discard.
 */
let unloading = false

function markUnloading(event: PageTransitionEvent) {
  if (!event.persisted) unloading = true
}

function clearUnloading() {
  unloading = false
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', markUnloading)
  window.addEventListener('pageshow', clearUnloading)
}

export function isPageUnloading(): boolean {
  return unloading
}
