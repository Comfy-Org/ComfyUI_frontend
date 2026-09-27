import type { LogsEvent } from '@datadog/browser-logs'
import { WORKSHOP_RELEASE } from 'astro:env/client'

import type { WorkshopAnalyticsEvent } from './workshop-analytics'
import { workshopHealthLog } from './workshop-health'
import type { WorkshopHealthLog } from './workshop-health'

export function workshopDatadogEnvironment(hostname: string) {
  if (hostname === 'comfy.org' || hostname === 'www.comfy.org') return 'prod-v2'
  if (hostname.endsWith('.vercel.app')) return 'preview'
  return undefined
}

export function redactWorkshopLog(log: LogsEvent) {
  log.view = { url: 'https://comfy.org/models/' }
  delete log.http
  delete log.error
  delete log.usr
  delete log.account
  delete log.session_id
  delete log.session
  return true
}

async function createLogger(env: string) {
  const { datadogLogs } = await import('@datadog/browser-logs')
  datadogLogs.init({
    clientToken: 'pub7704486e5b64eb4ff6f62891cda45559',
    site: 'us5.datadoghq.com',
    service: 'comfy-website',
    env,
    version: WORKSHOP_RELEASE,
    sessionSampleRate: 100,
    telemetrySampleRate: 0,
    forwardErrorsToLogs: false,
    forwardConsoleLogs: [],
    forwardReports: [],
    trackAnonymousUser: false,
    useSecureSessionCookie: true,
    beforeSend: redactWorkshopLog
  })
  return (event: WorkshopHealthLog) => {
    datadogLogs.logger.info('workshop run', event)
  }
}

let logger: ReturnType<typeof createLogger> | undefined

export function captureWorkshopHealth(event: WorkshopAnalyticsEvent): void {
  if (typeof window === 'undefined') return
  const env = workshopDatadogEnvironment(window.location.hostname)
  const record = workshopHealthLog(event)
  if (!env || !record) return
  logger ??= createLogger(env)
  void logger
    .then((send) => send(record))
    .catch(() => {
      logger = undefined
    })
}
