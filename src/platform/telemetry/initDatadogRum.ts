import { datadogRum } from '@datadog/browser-rum'

import { rumBeforeSend } from './datadogRumBeforeSend'

const DATADOG_ENV_BY_HOSTNAME = new Map([
  ['cloud.comfy.org', 'prod-v2'],
  ['stagingcloud.comfy.org', 'stg-v2'],
  ['testcloud.comfy.org', 'test-v2']
])

export function initDatadogRum(hostname = window.location.hostname): void {
  const env = DATADOG_ENV_BY_HOSTNAME.get(hostname)
  if (!env || datadogRum.getInitConfiguration()) return

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
}
