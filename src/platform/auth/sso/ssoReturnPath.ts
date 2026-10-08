const SPA_ONLY_CONSENT_PATH = '/oauth/consent'
const SERVED_CONSENT_PATH = '/cloud/oauth/consent'

/**
 * The path SSO's callback can land on with a full page load. The server
 * serves the consent page only at `/cloud/oauth/consent`, which the SPA then
 * redirects; a direct `/oauth/consent` load gets a 404.
 */
export function toSsoReturnPath(fullPath: string): string {
  const url = new URL(fullPath, 'http://sso.invalid')
  if (url.pathname !== SPA_ONLY_CONSENT_PATH) return fullPath
  return `${SERVED_CONSENT_PATH}${url.search}${url.hash}`
}
