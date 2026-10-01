const MEDIA_ROUTE =
  /^(?:\/api)?\/(?:view|viewvideo|vhs\/viewvideo|vhs\/viewaudio|assets\/[^/?#]+\/content)(?:\?|$)/

/**
 * Whether a route is one of the media routes a browser fetches without
 * headers, because an `<img>` or `<video>` src cannot carry any.
 *
 * This is the one list. Anything that has to recognise a media URL asks here
 * rather than keeping a second, narrower copy that drifts — the agent panel's
 * loopback re-homing kept one that missed `/vhs/viewvideo`, `/vhs/viewaudio`
 * and `/assets/<id>/content` while accepting a `/viewaudio` that no route
 * serves.
 */
export function isMediaRoute(route: string): boolean {
  return MEDIA_ROUTE.test(route)
}

/**
 * Names the workspace on a media route, which an image or video tag loads
 * without headers; absent means the personal workspace.
 */
export function scopeMediaRoute(
  route: string,
  workspaceId: string | undefined
): string {
  if (!workspaceId || !isMediaRoute(route)) return route
  if (/[?&]workspace_id=/.test(route)) return route
  const separator = route.includes('?') ? '&' : '?'
  return `${route}${separator}workspace_id=${encodeURIComponent(workspaceId)}`
}
