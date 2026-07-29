import type { RouteLocationNormalized } from 'vue-router'

/**
 * Routes a signed-out visitor is allowed to reach, shared by the cloud auth
 * guard and by surfaces that must not present themselves there.
 */
const PUBLIC_ROUTE_NAMES = new Set([
  'cloud-login',
  'cloud-signup',
  'cloud-forgot-password',
  'cloud-oauth-consent',
  'cloud-sorry-contact-support'
])

const PUBLIC_ROUTE_PATHS = new Set([
  '/cloud/login',
  '/cloud/signup',
  '/cloud/forgot-password',
  '/oauth/consent',
  '/cloud/sorry-contact-support'
])

export function isPublicRoute(
  to: Pick<RouteLocationNormalized, 'name' | 'path'>
): boolean {
  return (
    PUBLIC_ROUTE_NAMES.has(String(to.name)) || PUBLIC_ROUTE_PATHS.has(to.path)
  )
}
