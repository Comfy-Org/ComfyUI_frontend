import { datadogRum } from '@datadog/browser-rum'

import { rumBeforeSend } from './datadogRumBeforeSend'

const DATADOG_ENV_BY_HOSTNAME = new Map([
  ['cloud.comfy.org', 'prod-v2'],
  ['stagingcloud.comfy.org', 'stg-v2'],
  ['testcloud.comfy.org', 'test-v2']
])
const FRONTEND_CONTEXT_FETCH_TIMEOUT_MS = 1_000
const USER_MANUAL_REFRESH_PENDING_KEY = 'user_manual_refresh_pending'
let initializationPromise: Promise<void> | undefined

function emitPendingUserManualRefresh(): void {
  try {
    if (sessionStorage.getItem(USER_MANUAL_REFRESH_PENDING_KEY) !== 'true') {
      return
    }

    sessionStorage.removeItem(USER_MANUAL_REFRESH_PENDING_KEY)
    datadogRum.addAction('user_manual_refresh')
  } catch {
    return
  }
}

function trackUserManualRefresh(): void {
  emitPendingUserManualRefresh()

  const navigation = window.navigation
  if (!navigation) return

  navigation.addEventListener('navigate', (event) => {
    if (event.navigationType !== 'reload' || !event.userInitiated) return

    try {
      sessionStorage.setItem(USER_MANUAL_REFRESH_PENDING_KEY, 'true')
    } catch {
      return
    }
  })
}

async function setFrontendContext(): Promise<void> {
  const response = await fetch(window.location.origin, {
    method: 'HEAD',
    cache: 'no-store',
    signal: AbortSignal.timeout(FRONTEND_CONTEXT_FETCH_TIMEOUT_MS)
  })
  if (!response.ok) return

  const frontendVersion = response.headers.get('X-Frontend-Version')
  if (frontendVersion !== __COMFYUI_FRONTEND_COMMIT__) return

  datadogRum.setGlobalContextProperty(
    'bucket',
    response.headers.get('X-Frontend-Bucket') ?? 'stable'
  )
  datadogRum.setGlobalContextProperty('version', frontendVersion)
}

async function initializeDatadogRum(env: string): Promise<void> {
  await setFrontendContext().catch(() => {})
  if (datadogRum.getInitConfiguration()) return

  datadogRum.init({
    clientToken: 'pub7704486e5b64eb4ff6f62891cda45559',
    applicationId: '041a9897-5516-4b1f-a245-1a9aa6895488',
    site: 'us5.datadoghq.com',
    service: 'comfy-cloud-frontend',
    env,
    version: __COMFYUI_FRONTEND_VERSION__,
    beforeSend: rumBeforeSend,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 0,
    allowedTracingUrls: [/^https:\/\/[^/]+\.comfy\.org/]
  })
  trackUserManualRefresh()
}

export function initDatadogRum(
  hostname = window.location.hostname
): Promise<void> {
  const env =
    DATADOG_ENV_BY_HOSTNAME.get(hostname) ??
    (hostname.endsWith('.testenvs.comfy.org') ? 'test-v2' : undefined)
  if (!env || datadogRum.getInitConfiguration()) return Promise.resolve()

  initializationPromise ??= initializeDatadogRum(env).finally(() => {
    initializationPromise = undefined
  })
  return initializationPromise
}
