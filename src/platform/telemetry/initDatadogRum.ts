// oxlint-disable-next-line no-restricted-imports -- the telemetry layer owns the sinks that reportError() fans out to
import { datadogRum } from '@datadog/browser-rum'
import { once } from 'es-toolkit'

import { COMFY_RUM_APPLICATION } from '@comfyorg/shared-frontend-utils/telemetry'

import { rumBeforeSend } from './datadogRumBeforeSend'
import { trackUserManualRefresh } from './manualRefreshTracker'
import {
  installDatadogRum,
  resolveDeployEnv,
  setFrontendBucket
} from './rumContext'
import type { FrontendBucket } from './rumContext'

const FRONTEND_CONTEXT_FETCH_TIMEOUT_MS = 1_000
const FRONTEND_BUCKETS: readonly FrontendBucket[] = ['canary', 'stable']

function parseFrontendBucket(value: string | null): FrontendBucket {
  return FRONTEND_BUCKETS.includes(value as FrontendBucket)
    ? (value as FrontendBucket)
    : 'stable'
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

  const bucket = parseFrontendBucket(response.headers.get('X-Frontend-Bucket'))
  setFrontendBucket(bucket)
  datadogRum.setGlobalContextProperty('bucket', bucket)
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
    ...COMFY_RUM_APPLICATION,
    service: 'comfy-cloud-frontend',
    env,
    version: __COMFYUI_FRONTEND_COMMIT__,
    beforeSend: rumBeforeSend,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 0,
    trackFeatureFlagsForEvents: ['action', 'vital', 'long_task', 'resource'],
    allowedTracingUrls: [/^https:\/\/[^/]+\.comfy\.org/]
  })
  trackUserManualRefresh()
}

export const initDatadogRum = once(
  (hostname = window.location.hostname): Promise<void> => {
    installDatadogRum(datadogRum)
    const env = resolveDeployEnv(hostname)
    if (!env || datadogRum.getInitConfiguration()) return Promise.resolve()
    return initializeDatadogRum(env)
  }
)
