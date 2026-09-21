/**
 * The fragment that opens a model's API panel. A workflow page's endpoint
 * action and the playground live in separate islands, so the address bar
 * carries the request between them and the endpoint becomes linkable.
 */
export const WORKSHOP_API_HASH = '#api'

export function apiPanelRequested(): boolean {
  return (
    typeof window !== 'undefined' && window.location.hash === WORKSHOP_API_HASH
  )
}

/**
 * A panel the reader has left goes back to no fragment. Holding one the page
 * is no longer showing would make the next click on the endpoint action a
 * no-op, since the address would already say what the click asks for.
 */
export function releaseApiPanelHash(): void {
  if (!apiPanelRequested()) return
  const { pathname, search } = window.location
  window.history.replaceState(window.history.state, '', `${pathname}${search}`)
}
