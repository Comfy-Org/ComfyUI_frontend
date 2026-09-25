// oxlint-disable-next-line no-restricted-imports -- the telemetry layer owns the sinks that reportError() fans out to
import { datadogRum } from '@datadog/browser-rum'
// oxlint-disable-next-line no-restricted-imports -- the telemetry layer owns the sinks that reportError() fans out to
import { captureException, isEnabled as isSentryEnabled } from '@sentry/vue'

import type { ComfyDesktop2TelemetryProperties } from '@comfyorg/comfyui-desktop-bridge-types'

import { isCloud } from '@/platform/distribution/types'
import { isHostTelemetryEnabled } from '@/platform/telemetry/hostTelemetryEnabled'
import { toError } from '@/utils/errorUtil'

/**
 * Marks the console line `reportError()` writes for every report. RUM collects
 * `console.error` on its own, so `datadogRumBeforeSend` matches on this to drop
 * the untagged console copy of a failure it already received tagged.
 */
export const REPORTED_ERROR_PREFIX = '[Reported error]: '

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
  /**
   * Opt out of the console line for callers that already wrote one — only
   * `assert()`, which logs before any reporter is registered.
   */
  logToConsole?: boolean
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

/**
 * Reports raised before any sink is live are held here rather than dropped.
 * On cloud, Datadog RUM arrives behind `initTelemetry()`'s dynamic imports, so
 * its delivery remains pending even when Sentry received the report first.
 */
const pendingReports: PendingReport[] = []
const MAX_PENDING_REPORTS = 25

const isDatadogRumLive = () => datadogRum.getInitConfiguration() !== undefined

const definedEntriesOf = <V>(
  values: Record<string, V> | undefined
): Record<string, Exclude<V, undefined>> =>
  Object.fromEntries(
    Object.entries(values ?? {}).filter(
      (entry): entry is [string, Exclude<V, undefined>] =>
        entry[1] !== undefined
    )
  )

/** Written from `options`, so a caller tag of the same name never lands. */
const RESERVED_TAG_KEYS = new Set(['error_type', 'level'])

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
  error: { message: string; stack?: string },
  properties: ComfyDesktop2TelemetryProperties
) => void

function desktopExceptionSink(): DesktopCaptureException | undefined {
  if (!isHostTelemetryEnabled()) return

  const telemetry = window.__comfyDesktop2?.Telemetry
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
      { ...tags, error_type: errorType, ...(level ? { level } : {}) }
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

function dispatch(
  error: Error,
  options: ReportErrorOptions,
  alreadyDelivered: DeliveryState = NO_DELIVERY
): DeliveryState {
  const { errorType, level } = options
  const context = definedEntriesOf(options.context)
  const tags = definedTagsOf(options.tags)
  const sentryLive = !alreadyDelivered.sentry && isSentryEnabled()
  const datadogLive = !alreadyDelivered.datadog && isDatadogRumLive()
  let sentryDelivered = alreadyDelivered.sentry
  let datadogDelivered = alreadyDelivered.datadog
  let desktopDelivered = alreadyDelivered.desktop

  dispatching = true
  try {
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
        datadogDelivered = true
      } catch (reporterFailure) {
        console.error(
          '[reportError] Datadog delivery failed',
          reporterFailure,
          error
        )
      }
    }
  } finally {
    dispatching = false
  }
  if (!desktopDelivered) {
    desktopDelivered = dispatchToDesktop(error, errorType, tags, level)
  }

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

/**
 * Cloud wants the report in both of its own sinks and never has the Desktop
 * bridge, so `desktop` stays out of that branch — holding for a sink that
 * cannot arrive would pend every cloud report forever.
 *
 * Off cloud, Datadog RUM is gated on a comfy.org hostname it never sees on
 * Desktop, so a report the bridge accepted has to retire on that alone or the
 * buffer stays permanently full and every later report re-drains it.
 */
function isPending(delivered: DeliveryState): boolean {
  return isCloud
    ? !delivered.sentry || !delivered.datadog
    : !delivered.sentry && !delivered.datadog && !delivered.desktop
}

/**
 * A probe, not a delivery: `isHostTelemetryEnabled()` reads `localStorage` and
 * the bridge lookup touches an Electron context that can be revoked, and both
 * throw where `flushErrorReports()` promises not to.
 */
function hasLiveSink(): boolean {
  try {
    return isSentryEnabled() || isDatadogRumLive() || !!desktopExceptionSink()
  } catch (probeFailure) {
    console.error('[reportError] sink probe failed', probeFailure)
    return false
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

/**
 * Report an error to every observability sink at once.
 *
 * Prefer this to calling `captureException` or `datadogRum.addError`
 * directly: a raw `captureException` reaches Sentry only, which is how
 * `workspace_auth_gate_initialization_failure` stayed invisible on every
 * Datadog dashboard while it was firing in production.
 *
 * Also writes the failure to the console, so callers never pair this with a
 * `console.error` of their own: Sentry is off in DEV, RUM only comes up behind
 * `initTelemetry()`, and a caller that forgot the pair went silent on dev and
 * self-hosted installs.
 *
 * A report raised while a sink is still delivering only reaches the console.
 *
 * Never throws — a failing error reporter must not become a second failure.
 */
export function reportError(cause: unknown, options: ReportErrorOptions): void {
  try {
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
