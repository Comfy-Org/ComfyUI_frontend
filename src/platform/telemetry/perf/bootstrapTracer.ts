/**
 * Structured performance tracing for the app startup/bootstrap sequence.
 *
 * Each phase maps to one of the known bottlenecks from profiling:
 *
 *   Phase                          | Typical range (cloud, Lighthouse)
 *   ───────────────────────────────┼──────────────────────────────────
 *   startup/remote-config          | ~0–0.5 s  (pre-Firebase, blocking)
 *   startup/telemetry-init         | ~0–0.3 s
 *   startup/firebase-init          | ~0–0.1 s
 *   startup/sentry-init            | ~0–0.1 s
 *   auth-gate/initialized          | variable  (Firebase session restore)
 *   auth-gate/authenticated        | variable  (token refresh)
 *   auth-gate/user-store           | ~0–2.5 s  (GET /api/user/*)
 *   auth-gate/needs-login          | ~0 s      (computed resolution)
 *   bootstrap/settings             | ~0.2 s    (parallel, non-blocking)
 *   bootstrap/workflows            | ~0.3 s    (parallel, non-blocking)
 *   bootstrap/extensions-load      | ~0.5 s    (fetch + import /extensions JS)
 *   bootstrap/extensions-init      | ~0.3 s    (extension.init() hooks)
 *   bootstrap/object-info          | ~0.7 s    (GET /api/object_info)
 *   bootstrap/extensions           | ~0.5 s    (addCustomNodeDefs + registerCustomNodes)
 *   bootstrap/extensions-setup     | ~0.5 s    (extension.setup() hooks)
 *
 * Usage:
 *   import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
 *
 *   const phase = bootstrapTracer.startPhase('bootstrap/object-info')
 *   await this.getNodeDefs()
 *   phase.stop()
 */

import { perfMark, perfPoint } from './perfMark'
import type { PerfSpan } from './perfMark'

/** All known startup phase names. Extending this list is the only change
 *  required to add a new tracked phase. */
export type BootstrapPhase =
  | 'startup/remote-config'
  | 'startup/telemetry-init'
  | 'startup/firebase-init'
  | 'startup/sentry-init'
  | 'auth-gate/initialized'
  | 'auth-gate/authenticated'
  | 'auth-gate/user-store'
  | 'auth-gate/needs-login'
  | 'bootstrap/settings'
  | 'bootstrap/workflows'
  | 'bootstrap/extensions-load'
  | 'bootstrap/extensions-init'
  | 'bootstrap/object-info'
  | 'bootstrap/extensions'
  | 'bootstrap/extensions-setup'
  | 'bootstrap/app-mounted'

class BootstrapTracer {
  private _spans = new Map<BootstrapPhase, PerfSpan>()

  /**
   * Start timing a phase. Returns a handle; call `.stop()` when complete.
   * Calling startPhase for the same phase twice is safe (second call is a no-op
   * and returns the existing span's handle).
   */
  startPhase(phase: BootstrapPhase): { stop: () => number } {
    if (this._spans.has(phase)) {
      // Already running — return a no-op handle so callers don't have to guard
      return { stop: () => 0 }
    }
    const span = perfMark(`bootstrap/${phase}`)
    this._spans.set(phase, span)
    return {
      stop: () => {
        this._spans.delete(phase)
        return span.stop()
      }
    }
  }

  /**
   * Record a named milestone with no duration (e.g. "app shell mounted").
   */
  milestone(name: string): void {
    perfPoint(`bootstrap/milestone/${name}`)
  }

  /**
   * Return a summary of all completed bootstrap measures, sorted by start time.
   * Useful for logging to console in dev or emitting a single "startup complete"
   * event to analytics.
   */
  summary(): { name: string; durationMs: number; startMs: number }[] {
    return performance
      .getEntriesByType('measure')
      .filter((e) => e.name.startsWith('bootstrap/'))
      .sort((a, b) => a.startTime - b.startTime)
      .map((e) => ({
        name: e.name.replace(/^bootstrap\//, ''),
        durationMs: Math.round(e.duration),
        startMs: Math.round(e.startTime)
      }))
  }

  /**
   * Log the startup summary to the console in a compact table.
   * Only emits in dev or when DEBUG_PERF is set.
   */
  logSummary(): void {
    if (import.meta.env.DEV || localStorage.getItem('DEBUG_PERF') === 'true') {
      const rows = this.summary()
      if (rows.length === 0) return
      const total = rows.reduce((acc, r) => acc + r.durationMs, 0)
      console.warn(
        '[Bootstrap] Startup trace\n' +
          rows
            .map((r) => `  ${r.startMs}ms  ${r.name}: ${r.durationMs}ms`)
            .join('\n') +
          `\n  Total instrumented: ${total}ms`
      )
    }
  }
}

/** Singleton tracer — import and use directly. */
export const bootstrapTracer = new BootstrapTracer()
