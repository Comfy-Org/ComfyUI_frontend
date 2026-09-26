const CLIENT_ID_VAR = 'DEV_SERVER_CF_ACCESS_CLIENT_ID'
const CLIENT_SECRET_VAR = 'DEV_SERVER_CF_ACCESS_CLIENT_SECRET'

const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '::1', '[::1]']

function keepsCredentialsOnTheWire(targetUrl: string): boolean {
  try {
    const { protocol, hostname } = new URL(targetUrl)
    if (protocol === 'https:') return true
    return protocol === 'http:' && LOOPBACK_HOSTNAMES.includes(hostname)
  } catch {
    return false
  }
}

/**
 * Service-token headers for a dev-server backend behind Cloudflare Access.
 *
 * Returns undefined when no token is configured, so an unconfigured checkout
 * proxies exactly as it did before.
 */
export function cloudflareAccessHeaders(
  env: Record<string, string | undefined>,
  targetUrl: string
): Record<string, string> | undefined {
  const clientId = env[CLIENT_ID_VAR]
  const clientSecret = env[CLIENT_SECRET_VAR]

  if (!clientId && !clientSecret) return undefined

  if (!clientId || !clientSecret) {
    throw new Error(
      `${CLIENT_ID_VAR} and ${CLIENT_SECRET_VAR} must be configured together.`
    )
  }

  if (!keepsCredentialsOnTheWire(targetUrl)) {
    throw new Error(
      `${CLIENT_ID_VAR} must not be forwarded to a cleartext target; got ${targetUrl}`
    )
  }

  return {
    'CF-Access-Client-Id': clientId,
    'CF-Access-Client-Secret': clientSecret
  }
}
