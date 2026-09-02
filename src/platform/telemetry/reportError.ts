// eslint-disable-next-line no-restricted-imports -- the telemetry layer owns the sinks that reportError() fans out to
import { datadogRum } from '@datadog/browser-rum'
// eslint-disable-next-line no-restricted-imports -- the telemetry layer owns the sinks that reportError() fans out to
import { captureException, isEnabled as isSentryEnabled } from '@sentry/vue'

import { isCloud } from '@/platform/distribution/types'
import { toError } from '@/utils/errorUtil'

export interface ReportErrorOptions {
  /**
   * Stable machine-readable slug for this failure mode. Lands as the
   * `error_type` Sentry tag and the `error_type` RUM context field, so the
   * same query works against either console.
   */
  errorType: string
  tags?: Record<string, string | number | boolean | undefined>
  context?: Record<string, unknown>
  level?: 'warning' | 'error'
}

interface PendingReport {
  error: Error
  options: ReportErrorOptions
  sentryDelivered: boolean
}

/**
 * Reports raised before any sink is live are held here rather than dropped.
 * On cloud, Datadog RUM arrives behind `initTelemetry()`'s dynamic imports, so
 * its delivery remains pending even when Sentry received the report first.
 */
const pendingReports: PendingReport[] = []
const MAX_PENDING_REPORTS = 25

const isDatadogRumLive = () => datadogRum.getInitConfiguration() !== undefined

const definedEntriesOf = (
  tags: ReportErrorOptions['tags']
): Record<string, string | number | boolean> =>
  Object.fromEntries(
    Object.entries(tags ?? {}).filter(([, value]) => value !== undefined)
  ) as Record<string, string | number | boolean>

function dispatch(
  error: Error,
  options: ReportErrorOptions,
  sentryAlreadyDelivered = false
): { sentry: boolean; datadog: boolean } {
  const { errorType, context, level } = options
  const tags = definedEntriesOf(options.tags)
  const sentryLive = !sentryAlreadyDelivered && isSentryEnabled()
  const datadogLive = isDatadogRumLive()
  let sentryDelivered = false
  let datadogDelivered = false

  if (sentryLive) {
    try {
      captureException(error, {
        tags: { ...tags, error_type: errorType },
        extra: context,
        level
      })
      sentryDelivered = true
    } catch (reporterFailure) {
      console.error(
        '[reportError] Sentry delivery failed',
        reporterFailure,
        error
      )
    }
  }
  if (datadogLive) {
    try {
      datadogRum.addError(error, {
        ...context,
        ...tags,
        error_type: errorType,
        ...(level ? { level } : {})
      })
      datadogDelivered = true
    } catch (reporterFailure) {
      console.error(
        '[reportError] Datadog delivery failed',
        reporterFailure,
        error
      )
    }
  }

  return { sentry: sentryDelivered, datadog: datadogDelivered }
}

function enqueuePendingReport(report: PendingReport): void {
  if (pendingReports.length < MAX_PENDING_REPORTS) {
    pendingReports.push(report)
  }
}

/**
 * Drains reports buffered before a sink came up. Safe to call repeatedly;
 * a no-op while every sink is still inert.
 *
 * Callers are `main.ts` and `bootstrap.ts` on the boot path, so this must
 * never throw: a sink that explodes here would take the whole app down
 * instead of the one report it failed to deliver.
 */
export function flushErrorReports(): void {
  if (!pendingReports.length) return
  if (!isSentryEnabled() && !isDatadogRumLive()) return

  const drained = pendingReports.splice(0, pendingReports.length)
  for (const report of drained) {
    const { error, options } = report
    try {
      const delivered = dispatch(error, options, report.sentryDelivered)
      const sentryDelivered = report.sentryDelivered || delivered.sentry
      if (isCloud && !delivered.datadog) {
        enqueuePendingReport({ error, options, sentryDelivered })
      }
    } catch (reporterFailure) {
      enqueuePendingReport(report)
      console.error('[reportError] failed to flush', reporterFailure, error)
    }
  }
}

/**
 * Report an error to every observability sink at once.
 *
 * Prefer this to calling `captureException` or `datadogRum.addError`
 * directly: a raw `captureException` reaches Sentry only, which is how
 * `workspace_auth_gate_initialization_failure` stayed invisible on every
 * Datadog dashboard while it was firing in production.
 *
 * Never throws — a failing error reporter must not become a second failure.
 */
export function reportError(cause: unknown, options: ReportErrorOptions): void {
  try {
    flushErrorReports()

    const error = toError(cause)
    const delivered = dispatch(error, options)
    if (isCloud && !delivered.datadog) {
      enqueuePendingReport({
        error,
        options,
        sentryDelivered: delivered.sentry
      })
      return
    }
    if (delivered.sentry || delivered.datadog) return

    enqueuePendingReport({ error, options, sentryDelivered: false })
  } catch (reporterFailure) {
    console.error('[reportError] failed to report', reporterFailure, cause)
  }
}
