const MEDIA_ROUTE =
  /^(?:\/api)?\/(?:view|viewvideo|vhs\/viewvideo|vhs\/viewaudio|assets\/[^/?#]+\/content)(?:\?|$)/

/** True when the route is one a media element loads without headers. */
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
