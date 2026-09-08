/**
 * Thin performance instrumentation primitives.
 *
 * Ground truth is the browser Performance API (marks/measures); everything the
 * tracer reports is read back from that timeline.
 *
 * Each phase boundary is also published as a Datadog RUM custom timing, which
 * lands in `@view.custom_timings.<name>` and is charted and monitored natively
 * — no hand-built dashboard needed. The RUM SDK buffers API calls made before
 * `datadogRum.init()` resolves (a 500-entry bounded buffer drained on init) and
 * `addTiming` stamps the timestamp at call time, so phases that complete during
 * the init window are recorded accurately rather than dropped.
 *
 * Sentry breadcrumbs are a secondary consumer so a startup error carries the
 * phase timings that preceded it.
 */
// eslint-disable-next-line no-restricted-imports -- the telemetry layer owns the sinks that reportError() fans out to
import { datadogRum } from '@datadog/browser-rum'
import { addBreadcrumb } from '@sentry/vue'

import { reportError } from '@/platform/telemetry/reportError'
import type { BootstrapCompleteMetadata } from '@/platform/telemetry/types'

export interface PerfSpan {
  /** Wall-clock ms since navigationStart when mark() was called. */
  startMs: number
  /** Call stop() to end the span and record the measure. */
  stop(): number
}

const NOOP_PERF_SPAN: PerfSpan = {
  startMs: 0,
  stop: () => 0
}

/**
 * RUM accepts only `[a-zA-Z0-9-_.@$]` in a custom timing name and rewrites
 * anything else to `_` — logging a console warning on every call while it does
 * so. Our phase names are slash-separated, so map the separator to `.` before
 * handing it over rather than emitting a warning per phase per page load.
 */
const toRumTimingName = (name: string) => name.replace(/\//g, '.')

let rumFailureReported = false

/**
 * A throwing RUM call means startup telemetry is silently absent, which is the
 * failure mode that let an entirely dead sink ship unnoticed. Report it — but
 * once: a broken SDK would otherwise raise one report per phase per load, and
 * `reportError` reaches the same sink that just failed.
 */
function reportRumFailure(error: unknown, operation: string): void {
  if (rumFailureReported) return
  rumFailureReported = true
  reportError(error, {
    errorType: 'failure_publishing_startup_telemetry',
    tags: { operation }
  })
}

/**
 * Begin a named performance span.
 *
 * Records a `performance.mark('<name>:start')`. Calling `stop()` records
 * `performance.mark('<name>:end')` + `performance.measure('<name>', ...)`,
 * publishes the boundary to RUM and Sentry, and returns the elapsed
 * milliseconds. Repeat `stop()` calls return the first measured duration
 * without re-recording.
 *
 * @example
 * const span = perfMark('bootstrap/object-info')
 * await this.getNodeDefs()
 * const ms = span.stop()
 */
export function perfMark(name: string): PerfSpan {
  const startName = `${name}:start`
  const endName = `${name}:end`

  try {
    performance.mark(startName)
    const startMs = performance.now()
    let durationMs: number | undefined

    return {
      startMs,
      stop(): number {
        if (durationMs !== undefined) return durationMs
        try {
          performance.mark(endName)
          durationMs = _measure(name, startName, endName, startMs)
          _emitToRum(name)
          _emitToSentry(name, durationMs)
          return durationMs
        } catch {
          durationMs = 0
          return 0
        }
      }
    }
  } catch {
    return NOOP_PERF_SPAN
  }
}

/**
 * Mark a single point-in-time milestone (no duration).
 */
export function perfPoint(name: string): void {
  try {
    performance.mark(name)
    _emitToRum(name)
    _emitToSentry(name, 0)
  } catch {
    return
  }
}

function _measure(
  name: string,
  startName: string,
  endName: string,
  fallbackStart: number
): number {
  try {
    return performance.measure(name, startName, endName).duration
  } catch {
    return performance.now() - fallbackStart
  }
}

/**
 * Custom timings attach to the view that is current when they are recorded,
 * and RUM drops them once that view has ended. A route change mid-startup —
 * the login redirect, most notably — therefore truncates the timing series.
 * The `app:bootstrap_complete` action carries the full breakdown for exactly
 * that reason; these timings are the natively-charted convenience, not the
 * system of record.
 */
function _emitToRum(name: string): void {
  try {
    datadogRum.addTiming(toRumTimingName(name))
  } catch (error) {
    reportRumFailure(error, 'add_timing')
  }
}

/**
 * Publish the startup summary straight to RUM.
 *
 * The registry (`useTelemetry()`) is null until `initTelemetry()`'s dynamic
 * imports resolve, which is mid-startup — so a boot-path signal routed only
 * through it is missing in the sessions where startup stalled before that
 * point. `reportError()` bypasses the registry for the same reason. The SDK's
 * pre-init buffer means this reaches Datadog even when RUM itself is still
 * coming up.
 *
 * PostHog receives the same row through the registry, per
 * ADR-TELEMETRY-ROUTING-0013's dual-emission split.
 */
export function reportBootstrapToRum(
  eventName: string,
  metadata: BootstrapCompleteMetadata
): void {
  try {
    datadogRum.addAction(eventName, metadata)
  } catch (error) {
    reportRumFailure(error, 'add_action')
  }
}

/**
 * Tell RUM the initial view finished loading, populating `@view.loading_time`.
 *
 * Called only for a startup that reached a working app: a failed or still-hung
 * startup has not "loaded", and folding those into the same field would let a
 * fast failure drag the loading-time percentiles down. Those outcomes are
 * counted through `app:bootstrap_complete`'s `outcome` facet instead.
 */
export function markViewLoaded(): void {
  try {
    datadogRum.setViewLoadingTime()
  } catch (error) {
    reportRumFailure(error, 'set_view_loading_time')
  }
}

function _emitToSentry(name: string, durationMs: number): void {
  try {
    // addBreadcrumb is a module-level function in @sentry/vue v10 — safe to
    // call before Sentry.init() completes (it queues internally).
    addBreadcrumb({
      category: 'perf',
      message: name,
      level: 'info',
      data: { duration_ms: durationMs }
    })
  } catch {
    // never break the app for telemetry
  }
}
