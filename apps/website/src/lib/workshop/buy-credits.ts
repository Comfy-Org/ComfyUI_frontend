/**
 * The MVP rail (DES-1015): buying happens on platform.comfy.org, in a new
 * tab so the model page and its inputs stay alive. The workspace travels as
 * the server-resolved id — comfy.org and platform keep separate switchers,
 * and without it a buyer can top up the wallet that is not the empty one.
 * The parameter name is the shape agreed for platform's deep-link work, not
 * yet its confirmed contract.
 *
 * Always the production origin, even though staging/test previews mint
 * workspace ids platform cannot resolve: no lower-environment platform
 * origin is modeled in this app yet. Resolve alongside the deep-link
 * contract before the Workshop ships against prod Cloud.
 */
const PLATFORM_ORIGIN = 'https://platform.comfy.org'

export function platformTopUpHref(workspaceId?: string): string {
  const url = new URL('/billing', PLATFORM_ORIGIN)
  if (workspaceId) url.searchParams.set('workspace', workspaceId)
  return url.toString()
}
