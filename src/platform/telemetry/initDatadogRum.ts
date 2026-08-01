import { datadogRum } from '@datadog/browser-rum'

import { probeFrontendVersion } from '@/platform/updates/common/frontendVersionProbe'

import { rumBeforeSend } from './datadogRumBeforeSend'
import { trackUserManualRefresh } from './manualRefreshTracker'

const DATADOG_ENV_BY_HOSTNAME = new Map([
  ['cloud.comfy.org', 'prod-v2'],
  ['stagingcloud.comfy.org', 'stg-v2'],
  ['testcloud.comfy.org', 'test-v2']
])
let initializationPromise: Promise<void> | undefined

async function setFrontendContext(): Promise<void> {
  const probe = await probeFrontendVersion()
  if (!probe) return

  const frontendVersion = probe.version
  if (frontendVersion !== __COMFYUI_FRONTEND_COMMIT__) return

  datadogRum.setGlobalContextProperty('bucket', probe.bucket ?? 'stable')
  datadogRum.setGlobalContextProperty('version', frontendVersion)
}

async function initializeDatadogRum(env: string): Promise<void> {
  datadogRum.setGlobalContextProperty(
    'comfyui_frontend_version',
    __COMFYUI_FRONTEND_VERSION__
  )
  await setFrontendContext().catch(() => {})
  if (datadogRum.getInitConfiguration()) return

  datadogRum.init({
    clientToken: 'pub7704486e5b64eb4ff6f62891cda45559',
    applicationId: '041a9897-5516-4b1f-a245-1a9aa6895488',
    site: 'us5.datadoghq.com',
    service: 'comfy-cloud-frontend',
    env,
    version: __COMFYUI_FRONTEND_COMMIT__,
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
