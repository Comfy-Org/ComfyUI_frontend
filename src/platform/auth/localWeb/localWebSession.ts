import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { startDesktopHostSession } from '@/platform/auth/desktopHost/desktopHostSession'
import type {
  FailedSignIn,
  LocalWebAuthEnvironment
} from '@/platform/auth/localWeb/localWebAuthBridge'
import { createLocalWebAuthBridge } from '@/platform/auth/localWeb/localWebAuthBridge'
import { createStorageTokenStore } from '@/platform/auth/localWeb/localWebTokenStore'
import { reportError } from '@comfyorg/telemetry/reportError'

/**
 * Hosts whose origin Cloud allows to read `/oauth/token` responses. `[::1]` is
 * a registered redirect but has no CORS origin, so it cannot finish a sign-in.
 */
const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set([
  '127.0.0.1',
  'localhost'
])

const REFRESH_LOCK_NAME = 'Comfy.LocalWebSignIn.Refresh'
const POPUP_FEATURES = 'popup,width=520,height=720'

function reportSignInFailure(failure: FailedSignIn): void {
  reportError(new Error(`local web sign-in failed: ${failure.reason}`), {
    errorType: 'local_web_sign_in_failed',
    surface: 'auth',
    context: { reason: failure.reason, oauthError: failure.error }
  })
}

function withOriginLock<T>(task: () => Promise<T>): Promise<T> {
  return navigator.locks.request(REFRESH_LOCK_NAME, task)
}

interface SignInFailureNotices {
  onPopupBlocked: () => void
}

function browserEnvironment({
  onPopupBlocked
}: SignInFailureNotices): LocalWebAuthEnvironment {
  return {
    issuer: getComfyCloudBaseUrl(),
    pageUrl: () => window.location.href,
    replaceUrl: (url) =>
      window.history.replaceState(window.history.state, '', url),
    sessionStorage: {
      getItem: (key) => window.sessionStorage.getItem(key),
      setItem: (key, value) => window.sessionStorage.setItem(key, value),
      removeItem: (key) => window.sessionStorage.removeItem(key)
    },
    tokens: createStorageTokenStore(
      {
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
        removeItem: (key) => window.localStorage.removeItem(key)
      },
      window
    ),
    withRefreshLock: withOriginLock,
    fetchImpl: (input, init) => fetch(input, init),
    now: () => Date.now(),
    openPopup: () => window.open('about:blank', '_blank', POPUP_FEATURES),
    onMessage(listener) {
      const onMessage = (event: MessageEvent) => listener(event)
      window.addEventListener('message', onMessage)
      return () => window.removeEventListener('message', onMessage)
    },
    reportSignInFailure(failure) {
      reportSignInFailure(failure)
      if (failure.reason === 'popup-blocked') onPopupBlocked()
    }
  }
}

export type LocalWebSessionStart = 'off' | 'started' | 'sign-in-failed'

/**
 * Signs a local ComfyUI in to Cloud from the browser when Desktop does not
 * host it. Off unless `local_web_sso` is on and the page is on a loopback
 * host; a sign-in the redirect brought back is finished before the session
 * starts, so the first state consumers read already includes it.
 * `sign-in-failed` means the returned sign-in failed for a reason other than
 * the person declining consent, so the page should say so once it mounts.
 */
export async function startLocalWebSession(
  notices: SignInFailureNotices,
  env: LocalWebAuthEnvironment = browserEnvironment(notices)
): Promise<LocalWebSessionStart> {
  if (!useFeatureFlags().flags.localWebSsoEnabled) return 'off'
  if (!LOOPBACK_HOSTNAMES.has(new URL(env.pageUrl()).hostname)) return 'off'

  const bridge = createLocalWebAuthBridge(env)
  const outcome = await bridge.completeSignIn()
  const failed = outcome.kind === 'failed' && outcome.reason !== 'denied'
  if (failed) reportSignInFailure(outcome)
  await startDesktopHostSession(bridge)
  return failed ? 'sign-in-failed' : 'started'
}
