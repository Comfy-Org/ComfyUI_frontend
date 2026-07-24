/**
 * Thin performance instrumentation primitives.
 *
 * Ground truth is the browser Performance API (marks/measures). Datadog RUM
 * and Sentry are secondary consumers so the data shows up in dashboards and
 * traces without requiring both tools to agree on the recording strategy.
 *
 * OSS safety: neither Datadog nor Sentry are imported here — they are accessed
 * via well-known globals (DD_RUM, __SENTRY__) so this file is tree-shaken
 * cleanly in non-cloud builds.
 */

export interface PerfSpan {
  /** Wall-clock ms since navigationStart when mark() was called. */
  startMs: number
  /** Call stop() to end the span and record the measure. */
  stop(): number
}

/**
 * Begin a named performance span.
 *
 * Records a `performance.mark('<name>:start')`. Calling `stop()` records
 * `performance.mark('<name>:end')` + `performance.measure('<name>', ...)`,
 * sends a Datadog `addAction` and a Sentry breadcrumb, and returns the
 * elapsed milliseconds.
 *
 * @example
 * const span = perfMark('bootstrap/auth-gate')
 * await authStore.initialize()
 * const ms = span.stop()
 */
export function perfMark(name: string): PerfSpan {
  const startName = `${name}:start`
  const endName = `${name}:end`

  performance.mark(startName)
  const startMs = performance.now()

  return {
    startMs,
    stop(): number {
      performance.mark(endName)
      const durationMs = _measure(name, startName, endName, startMs)
      _emitToDatadog(name, durationMs)
      _emitToSentry(name, durationMs)
      return durationMs
    }
  }
}

/**
 * Mark a single point-in-time milestone (no duration).
 * Shows up in the Datadog RUM timeline as a custom action.
 */
export function perfPoint(name: string): void {
  performance.mark(name)
  _emitToDatadog(name, 0)
  _emitToSentry(name, 0)
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

function _emitToDatadog(name: string, durationMs: number): void {
  try {
    const dd = (
      window as { DD_RUM?: { addAction(n: string, c: object): void } }
    ).DD_RUM
    dd?.addAction(name, { duration_ms: durationMs })
  } catch {
    // never break the app for telemetry
  }
}

function _emitToSentry(name: string, durationMs: number): void {
  try {
    // addBreadcrumb is a module-level function in @sentry/vue v10 — safe to
    // call even before Sentry.init() completes (it queues internally).
    // Dynamic import keeps this out of OSS bundles via tree-shaking.
    void import('@sentry/vue').then(({ addBreadcrumb }) => {
      addBreadcrumb({
        category: 'perf',
        message: name,
        level: 'info',
        data: { duration_ms: durationMs }
      })
    })
  } catch {
    // never break the app for telemetry
  }
}

/**
 * Retrieve all recorded performance entries for a given prefix.
 * Useful for debugging in DevTools or in unit tests.
 */
export function getPerfEntries(prefix: string): PerformanceEntry[] {
  return performance
    .getEntriesByType('measure')
    .filter((e) => e.name.startsWith(prefix))
    .concat(
      performance
        .getEntriesByType('mark')
        .filter((e) => e.name.startsWith(prefix))
    )
}

/** Clear all perf marks/measures with the given prefix (test cleanup). */
export function clearPerfEntries(prefix: string): void {
  for (const e of getPerfEntries(prefix)) {
    if (e.entryType === 'mark') performance.clearMarks(e.name)
    if (e.entryType === 'measure') performance.clearMeasures(e.name)
  }
}
