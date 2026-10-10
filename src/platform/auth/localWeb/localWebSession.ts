import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { startDesktopHostSession } from '@/platform/auth/desktopHost/desktopHostSession'
import type { LocalWebAuthEnvironment } from '@/platform/auth/localWeb/localWebAuthBridge'
import { createLocalWebAuthBridge } from '@/platform/auth/localWeb/localWebAuthBridge'
import { createMemoryTokenStore } from '@/platform/auth/localWeb/localWebTokenStore'
import { reportError } from '@/platform/telemetry/reportError'

/**
 * Hosts whose origin Cloud allows to read `/oauth/token` responses. `[::1]` is
 * a registered redirect but has no CORS origin, so it cannot finish a sign-in.
 */
const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set([
  '127.0.0.1',
  'localhost'
])

function browserEnvironment(): LocalWebAuthEnvironment {
  return {
    issuer: getComfyCloudBaseUrl(),
    pageUrl: () => window.location.href,
    navigate: (url) => window.location.assign(url),
    replaceUrl: (url) =>
      window.history.replaceState(window.history.state, '', url),
    sessionStorage: {
      getItem: (key) => window.sessionStorage.getItem(key),
      setItem: (key, value) => window.sessionStorage.setItem(key, value),
      removeItem: (key) => window.sessionStorage.removeItem(key)
    },
    tokens: createMemoryTokenStore(),
    fetchImpl: (input, init) => fetch(input, init),
    now: () => Date.now()
  }
}

/**
 * Signs a local ComfyUI in to Cloud from the browser when Desktop does not
 * host it. Off unless `local_web_sso` is on and the page is on a loopback
 * host; a sign-in the redirect brought back is finished before the session
 * starts, so the first state consumers read already includes it.
 */
export async function startLocalWebSession(
  env: LocalWebAuthEnvironment = browserEnvironment()
): Promise<boolean> {
  if (!useFeatureFlags().flags.localWebSsoEnabled) return false
  if (!LOOPBACK_HOSTNAMES.has(new URL(env.pageUrl()).hostname)) return false

  const bridge = createLocalWebAuthBridge(env)
  const outcome = await bridge.completeSignIn()
  if (outcome.kind === 'failed' && outcome.reason !== 'denied') {
    reportError(new Error(`local web sign-in failed: ${outcome.reason}`), {
      errorType: 'local_web_sign_in_failed',
      surface: 'auth',
      context: { reason: outcome.reason, oauthError: outcome.error }
    })
  }
  await startDesktopHostSession(bridge)
  return true
}
