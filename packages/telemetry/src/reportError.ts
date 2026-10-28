import type { DatadogRum } from '@datadog/browser-rum'
import type * as Sentry from '@sentry/vue'
import type { ComfyDesktop2TelemetryProperties } from '@comfyorg/comfyui-desktop-bridge-types'
import { REPORTED_ERROR_PREFIX } from '@comfyorg/shared-frontend-utils/telemetry'
import { toError } from '@comfyorg/shared-frontend-utils/errorUtil'
import { redactTelemetryValues } from './redactTelemetryUrls'
import { getDatadogRum, getFrontendBucket } from './rumContext'
export type Surface =
  | 'agent'
  | 'billing'
  | 'graph'
  | 'auth'
  | 'assets'
  | 'workspace'
  | 'platform'
export interface ReportErrorOptions {
  errorType: string
  surface: Surface
  tags?: Record<string, string | number | boolean | undefined>
  context?: Record<string, unknown>
  level?: 'warning' | 'error'
  fingerprint?: string[]
  logToConsole?: boolean
}
export interface ErrorReporterDependencies {
  captureException: typeof Sentry.captureException
  isSentryEnabled: typeof Sentry.isEnabled
  isCloud: () => boolean
  isHostTelemetryEnabled: () => boolean
  getDesktopTelemetry: () => unknown
}
let dependencies: ErrorReporterDependencies | undefined

export function configureErrorReporter(next: ErrorReporterDependencies): void {
  dependencies = next
}

interface DeliveryState {
  sentry: boolean
  datadog: boolean
  desktop: boolean
}
interface PendingReport {
  error: Error
  options: ReportErrorOptions
  delivered: DeliveryState
}
const NO_DELIVERY: DeliveryState = {
  sentry: false,
  datadog: false,
  desktop: false
}
const pendingReports: PendingReport[] = []
const MAX_PENDING_REPORTS = 25
const reportedErrors = new WeakSet<Error>()
export function markErrorReported(error: Error): void {
  reportedErrors.add(error)
}
function liveDatadogRum(): DatadogRum | undefined {
  const rum = getDatadogRum()
  return rum?.getInitConfiguration() ? rum : undefined
}
const definedEntriesOf = <V>(
  values: Record<string, V> | undefined
): Record<string, Exclude<V, undefined>> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(
      (entry): entry is [string, Exclude<V, undefined>] =>
        entry[1] !== undefined
    )
  )
const RESERVED_TAG_KEYS = new Set(['error_type', 'level', 'surface', 'bucket'])
let dispatching = false
const definedTagsOf = (
  tags: ReportErrorOptions['tags']
): Record<string, string | number | boolean> =>
  Object.fromEntries(
    Object.entries(tags ?? {}).filter(
      (entry): entry is [string, string | number | boolean] => {
        const [key, value] = entry
        return (
          !RESERVED_TAG_KEYS.has(key) &&
          (typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean')
        )
      }
    )
  )
type DesktopCaptureException = (
  error: {
    message: string
    stack?: string
  },
  properties: ComfyDesktop2TelemetryProperties
) => void
function desktopExceptionSink(): DesktopCaptureException | undefined {
  if (!dependencies?.isHostTelemetryEnabled()) return
  const telemetry = dependencies.getDesktopTelemetry()
  if (!telemetry || typeof telemetry !== 'object') return
  if (!('captureException' in telemetry)) return
  const capture = telemetry.captureException
  if (typeof capture !== 'function') return
  return (error, properties) => {
    Reflect.apply(capture, telemetry, [error, properties])
  }
}
function dispatchToDesktop(
  error: Error,
  errorType: string,
  surface: Surface,
  tags: Record<string, string | number | boolean>,
  level?: ReportErrorOptions['level']
): boolean {
  try {
    const capture = desktopExceptionSink()
    if (!capture) return false
    capture(
      {
        message: error.message,
        ...(error.stack ? { stack: error.stack } : {})
      },
      {
        ...tags,
        error_type: errorType,
        surface,
        ...(level ? { level } : {})
      }
    )
    return true
  } catch (reporterFailure) {
    console.error(
      '[reportError] Desktop delivery failed',
      reporterFailure,
      error
    )
    return false
  }
}
function dispatchToSentry(
  error: Error,
  errorType: string,
  surface: Surface,
  tags: Record<string, string | number | boolean>,
  context: Record<string, unknown>,
  level: ReportErrorOptions['level'],
  fingerprint: ReportErrorOptions['fingerprint']
): boolean {
  if (!dependencies) return false
  try {
    dependencies.captureException(error, {
      tags: { ...tags, error_type: errorType, surface },
      extra: context,
      level,
      ...(fingerprint ? { fingerprint } : {})
    })
    return true
  } catch (reporterFailure) {
    console.error(
      '[reportError] Sentry delivery failed',
      reporterFailure,
      error
    )
    return false
  }
}
function dispatchToDatadog(
  datadogRum: DatadogRum,
  error: Error,
  errorType: string,
  surface: Surface,
  tags: Record<string, string | number | boolean>,
  context: Record<string, unknown>,
  level: ReportErrorOptions['level']
): boolean {
  try {
    const redactedCause = redactTelemetryValues({ cause: error.cause })?.cause
    const datadogError = Object.assign(new Error(error.message), error, {
      name: errorType,
      stack: error.stack,
      cause: redactedCause
    })
    datadogRum.addError(datadogError, {
      ...context,
      ...tags,
      error_type: errorType,
      surface,
      ...(level ? { level } : {})
    })
    return true
  } catch (reporterFailure) {
    console.error(
      '[reportError] Datadog delivery failed',
      reporterFailure,
      error
    )
    return false
  }
}
function dispatch(
  error: Error,
  options: ReportErrorOptions,
  alreadyDelivered: DeliveryState = NO_DELIVERY
): DeliveryState {
  const { errorType, surface, level, fingerprint } = options
  const context = definedEntriesOf(options.context)
  const bucket = getFrontendBucket()
  const tags = {
    ...definedTagsOf(options.tags),
    ...(bucket ? { bucket } : {})
  }
  const sentryLive = !alreadyDelivered.sentry && dependencies?.isSentryEnabled()
  const datadogRum = alreadyDelivered.datadog ? undefined : liveDatadogRum()
  let sentryDelivered = alreadyDelivered.sentry
  let datadogDelivered = alreadyDelivered.datadog
  dispatching = true
  try {
    if (sentryLive) {
      sentryDelivered = dispatchToSentry(
        error,
        errorType,
        surface,
        tags,
        context,
        level,
        fingerprint
      )
    }
    if (datadogRum) {
      datadogDelivered = dispatchToDatadog(
        datadogRum,
        error,
        errorType,
        surface,
        tags,
        context,
        level
      )
    }
  } finally {
    dispatching = false
  }
  const desktopDelivered =
    alreadyDelivered.desktop ||
    dispatchToDesktop(error, errorType, surface, tags, level)
  return {
    sentry: sentryDelivered,
    datadog: datadogDelivered,
    desktop: desktopDelivered
  }
}
function enqueuePendingReport(report: PendingReport): void {
  if (pendingReports.length < MAX_PENDING_REPORTS) {
    pendingReports.push(report)
  }
}
function isPending(delivered: DeliveryState): boolean {
  return dependencies?.isCloud()
    ? !delivered.sentry || !delivered.datadog
    : !delivered.sentry && !delivered.datadog && !delivered.desktop
}
function hasLiveSink(): boolean {
  try {
    return (
      dependencies?.isSentryEnabled() ||
      !!liveDatadogRum() ||
      !!desktopExceptionSink()
    )
  } catch (probeFailure) {
    console.error('[reportError] sink probe failed', probeFailure)
    return false
  }
}
export function flushErrorReports(): void {
  if (!pendingReports.length) return
  if (!hasLiveSink()) return
  const drained = pendingReports.splice(0, pendingReports.length)
  for (const report of drained) {
    const { error, options } = report
    try {
      const delivered = dispatch(error, options, report.delivered)
      if (isPending(delivered)) {
        enqueuePendingReport({ error, options, delivered })
      }
    } catch (reporterFailure) {
      enqueuePendingReport(report)
      console.error('[reportError] failed to flush', reporterFailure, error)
    }
  }
}
function logReport(
  cause: unknown,
  options: ReportErrorOptions,
  suffix = ''
): void {
  if (options.logToConsole === false) return
  const log = options.level === 'warning' ? console.warn : console.error
  log(`${REPORTED_ERROR_PREFIX}${options.errorType}${suffix}`, cause)
}
export function reportError(cause: unknown, options: ReportErrorOptions): void {
  try {
    if (cause instanceof Error && reportedErrors.has(cause)) return
    if (dispatching) {
      logReport(cause, options, ' (suppressed: raised while reporting)')
      return
    }
    logReport(cause, options)
    flushErrorReports()
    const error = toError(cause)
    const delivered = dispatch(error, options)
    if (isPending(delivered)) {
      enqueuePendingReport({ error, options, delivered })
    }
  } catch (reporterFailure) {
    console.error('[reportError] failed to report', reporterFailure, cause)
  }
}
