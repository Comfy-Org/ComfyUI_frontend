/**
 * Routes a signed-out visitor is allowed to sit on: the sign-in destination
 * itself and the flows that lead to it.
 *
 * Shared so the router's guard and the session-expiry redirect cannot drift.
 * `/cloud/oauth/consent` is only a legacy redirect stub — the live consent
 * screen is `/oauth/consent`, so matching must be prefix-based.
 */
export const PUBLIC_ROUTE_PATHS = [
  '/cloud/login',
  '/cloud/signup',
  '/cloud/forgot-password',
  '/oauth/consent',
  '/cloud/oauth',
  '/cloud/sorry-contact-support'
] as const

export function isPublicRoutePath(path: string): boolean {
  return PUBLIC_ROUTE_PATHS.some((prefix) => path.startsWith(prefix))
}
