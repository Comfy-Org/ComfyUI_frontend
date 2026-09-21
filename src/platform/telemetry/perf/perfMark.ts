/**
 * Thin performance instrumentation primitives.
 *
 * Ground truth is the browser Performance API (marks/measures); everything the
 * tracer reports is read back from that timeline. Sentry breadcrumbs are a
 * secondary consumer so a startup error carries the phase timings that preceded
 * it. Aggregate emission to analytics happens once, from `bootstrapTracer`,
 * rather than per mark — the telemetry registry does not exist yet while the
 * earliest phases are running.
 */
import { addBreadcrumb } from '@sentry/vue'

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
 * Begin a named performance span.
 *
 * Records a `performance.mark('<name>:start')`. Calling `stop()` records
 * `performance.mark('<name>:end')` + `performance.measure('<name>', ...)`,
 * adds a Sentry breadcrumb, and returns the elapsed milliseconds. Repeat
 * `stop()` calls return the first measured duration without re-recording.
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
