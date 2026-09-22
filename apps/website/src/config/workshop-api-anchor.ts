/**
 * The fragment a link can use to open a model's API panel. Nothing in the site
 * writes it any more — the panel is a tab the reader can see — but an address
 * carrying it still lands there, so a link someone saved or shared keeps
 * working.
 */
const WORKSHOP_API_HASH = '#api'

export function apiPanelRequested(): boolean {
  return (
    typeof window !== 'undefined' && window.location.hash === WORKSHOP_API_HASH
  )
}

/**
 * A panel the reader has left goes back to no fragment, so the address stops
 * claiming a view the page is no longer showing.
 */
export function releaseApiPanelHash(): void {
  if (!apiPanelRequested()) return
  const { pathname, search } = window.location
  window.history.replaceState(window.history.state, '', `${pathname}${search}`)
}
