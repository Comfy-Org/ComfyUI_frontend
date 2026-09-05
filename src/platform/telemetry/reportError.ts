// eslint-disable-next-line no-restricted-imports -- the telemetry layer owns the sinks that reportError() fans out to
import { datadogRum } from '@datadog/browser-rum'
// eslint-disable-next-line no-restricted-imports -- the telemetry layer owns the sinks that reportError() fans out to
import { captureException, isEnabled as isSentryEnabled } from '@sentry/vue'

import { toError } from '@/utils/errorUtil'

export interface ReportErrorOptions {
  /**
   * Stable machine-readable slug for this failure mode. Lands as the
   * native RUM `error.type`, the `error_type` Sentry tag, and the legacy
   * `error_type` RUM context field.
   */
  errorType: string
  tags?: Record<string, string | number | boolean | undefined>
  context?: Record<string, unknown>
  level?: 'warning' | 'error'
}

interface PendingReport {
  error: Error
  options: ReportErrorOptions
}

/**
 * Reports raised before any sink is live are held here rather than dropped.
 * Sentry initializes synchronously in main.ts but Datadog RUM arrives behind
 * `initTelemetry()`'s dynamic imports, so early-boot failures — the ones that
 * leave a user on the splash screen — would otherwise vanish exactly when
 * they matter most.
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

function dispatch(error: Error, options: ReportErrorOptions): boolean {
  const { errorType, context, level } = options
  const tags = definedEntriesOf(options.tags)
  const sentryLive = isSentryEnabled()
  const datadogLive = isDatadogRumLive()

  if (sentryLive) {
    captureException(error, {
      tags: { ...tags, error_type: errorType },
      extra: context,
      level
    })
  }
  if (datadogLive) {
    const datadogError = Object.assign(
      new Error(error.message, { cause: error.cause }),
      error,
      { name: errorType, stack: error.stack }
    )
    datadogRum.addError(datadogError, {
      ...context,
      ...tags,
      error_type: errorType,
      ...(level ? { level } : {})
    })
  }

  return sentryLive || datadogLive
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
  for (const { error, options } of drained) {
    try {
      dispatch(error, options)
    } catch (reporterFailure) {
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
    if (dispatch(error, options)) return

    if (pendingReports.length < MAX_PENDING_REPORTS) {
      pendingReports.push({ error, options })
    }
  } catch (reporterFailure) {
    console.error('[reportError] failed to report', reporterFailure, cause)
  }
}
