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
