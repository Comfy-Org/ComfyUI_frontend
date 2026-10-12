const MEDIA_ROUTE =
  /^(?:\/api)?\/(?:view|viewvideo|vhs\/viewvideo|vhs\/viewaudio|assets\/[^/?#]+\/content)(?:[?#]|$)/

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
  const hashStart = route.indexOf('#')
  const path = hashStart === -1 ? route : route.slice(0, hashStart)
  const fragment = hashStart === -1 ? '' : route.slice(hashStart)
  if (/[?&]workspace_id=/.test(path)) return route
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}workspace_id=${encodeURIComponent(workspaceId)}${fragment}`
}
