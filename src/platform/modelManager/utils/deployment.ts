import { isDesktop } from '@/platform/distribution/types'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/**
 * Whether the browser can reach the server's `127.0.0.1` loopback, which is
 * required for the model-download OAuth redirect to complete. True for the
 * Desktop app and for loopback hostnames; a remote server is treated as
 * non-local and must use the env-var API-key path instead.
 */
export function isLocalDeployment(): boolean {
  if (isDesktop) return true
  return LOOPBACK_HOSTS.has(window.location.hostname)
}
