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
 *   auth-gate/initialized          | variable  (Firebase session restore + timeout/retry)
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
 * Startup ends when the loading screen comes down, not when any one subsystem
 * finishes. `complete()` is therefore called from the single place that owns
 * that transition (`GraphCanvas`'s onMounted `finally`), so the trace covers
 * the extension and object-info phases that run inside `ComfyApp.setup()` and
 * so a startup that threw still reports. A startup that never gets there is
 * reported by `armWatchdog()`, armed from `main.ts` before blocking startup
 * work begins.
 *
 * Usage:
 *   import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
 *
 *   await bootstrapTracer.settle('bootstrap/object-info', () => this.getNodeDefs())
 */
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type { BootstrapCompleteMetadata } from '@/platform/telemetry/types'

import { perfMark, perfPoint } from './perfMark'
import type { PerfSpan } from './perfMark'

/**
 * Startup past this is abnormal by any reading — the slowest healthy cloud
 * load profiled is ~5 s, and the reports that prompted this instrumentation
 * were minutes.
 */
const BOOTSTRAP_WATCHDOG_MS = 30_000

const BOOTSTRAP_PHASES = {
  startup: ['remote-config', 'telemetry-init', 'firebase-init', 'sentry-init'],
  'auth-gate': ['initialized', 'user-store', 'needs-login'],
  bootstrap: [
    'settings',
    'workflows',
    'extensions-load',
    'extensions-init',
    'object-info',
    'extensions',
    'extensions-setup'
  ]
} as const satisfies Record<string, readonly string[]>

type BootstrapPhaseNamespace = keyof typeof BOOTSTRAP_PHASES

type BootstrapSubphase<Namespace extends BootstrapPhaseNamespace> =
  (typeof BOOTSTRAP_PHASES)[Namespace][number]

export type BootstrapPhase = {
  [Namespace in BootstrapPhaseNamespace]: `${Namespace}/${BootstrapSubphase<Namespace>}`
}[BootstrapPhaseNamespace]

export interface BootstrapPhaseTiming {
  name: BootstrapPhase
  startMs: number
  durationMs: number
}

export class BootstrapTracer {
  private _spans = new Map<BootstrapPhase, PerfSpan>()
  private _timings: BootstrapPhaseTiming[] = []
  private _completed = false
  private _watchdog: ReturnType<typeof setTimeout> | undefined

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
    this._spans.set(phase, perfMark(phase))
    return { stop: () => this._stopPhase(phase) }
  }

  private _stopPhase(phase: BootstrapPhase): number {
    const span = this._spans.get(phase)
    if (!span) return 0
    this._spans.delete(phase)
    const durationMs = span.stop()
    this._timings.push({
      name: phase,
      startMs: Math.round(span.startMs),
      durationMs: Math.round(durationMs)
    })
    return durationMs
  }

  /**
   * Time `work` and record the phase whether it resolves or rejects, then
   * re-settle exactly as `work` did.
   *
   * A phase stopped only on the success path goes unrecorded precisely when
   * startup went wrong, so the surviving sessions are the fast ones and every
   * percentile reads better than reality.
   */
  async settle<T>(phase: BootstrapPhase, work: () => Promise<T>): Promise<T> {
    const span = this.startPhase(phase)
    try {
      return await work()
    } finally {
      span.stop()
    }
  }

  /**
   * Record a named milestone with no duration (e.g. "app shell mounted").
   */
  milestone(name: string): void {
    perfPoint(`bootstrap/milestone/${name}`)
  }

  /**
   * Completed phases, in the order they started.
   *
   * Built from what this tracer measured rather than re-scanned out of
   * `performance.getEntriesByType('measure')`: that buffer is shared with
   * every other measure in the app and can be cleared by anyone.
   */
  summary(): BootstrapPhaseTiming[] {
    return [...this._timings].sort((a, b) => a.startMs - b.startMs)
  }

  /**
   * Close out startup: stop any phase still open, emit one aggregate event
   * carrying total wall-clock and the per-phase breakdown, and log the trace
   * locally. Idempotent — only the first call reports.
   *
   * One row per session is what makes "how many users hit a slow load"
   * answerable by percentile; fifteen separate per-phase events are not.
   */
  complete(outcome: 'completed' | 'failed' = 'completed'): void {
    if (this._completed) return
    this._completed = true
    clearTimeout(this._watchdog)
    for (const phase of [...this._spans.keys()]) this._stopPhase(phase)
    this._report(outcome)
  }

  /**
   * Report startup as still running if it has not completed by `deadlineMs`.
   *
   * A session that hangs never reaches `complete()`, so without this the loads
   * users actually report — the ones that spin for minutes — are the only ones
   * that produce no data at all. The watchdog row does not end the trace: the
   * terminal row still follows if startup eventually finishes.
   */
  armWatchdog(deadlineMs = BOOTSTRAP_WATCHDOG_MS): void {
    clearTimeout(this._watchdog)
    this._watchdog = setTimeout(() => {
      if (this._completed) return
      this._report('timed_out', [...this._spans.keys()])
    }, deadlineMs)
  }

  private _report(
    outcome: BootstrapCompleteMetadata['outcome'],
    pending?: BootstrapPhase[]
  ): void {
    try {
      const totalMs = Math.round(performance.now())
      const rows = this.summary()
      const metadata: BootstrapCompleteMetadata = {
        total_ms: totalMs,
        outcome,
        phase_count: rows.length,
        phases: Object.fromEntries(rows.map((r) => [r.name, r.durationMs])),
        ...(pending?.length ? { pending } : {})
      }
      const telemetry = useTelemetry()
      if (telemetry) {
        telemetry.trackBootstrapComplete(metadata)
      } else if (isCloud && outcome === 'timed_out') {
        void import('@/platform/telemetry/providers/cloud/DatadogRumTelemetryProvider')
          .then(({ DatadogRumTelemetryProvider }) => {
            new DatadogRumTelemetryProvider().trackBootstrapComplete(metadata)
          })
          .catch(() => {})
      }
      this._logSummary(rows, totalMs)
    } catch {
      return
    }
  }

  /**
   * Log the startup summary to the console in a compact table.
   * Only emits in dev or when DEBUG_PERF is set.
   */
  private _logSummary(rows: BootstrapPhaseTiming[], totalMs: number): void {
    if (!import.meta.env.DEV && localStorage.getItem('DEBUG_PERF') !== 'true')
      return
    if (rows.length === 0) return
    console.warn(
      '[Bootstrap] Startup trace\n' +
        rows
          .map((r) => `  ${r.startMs}ms  ${r.name}: ${r.durationMs}ms`)
          .join('\n') +
        `\n  Total wall-clock: ${totalMs}ms`
    )
  }
}

/** Singleton tracer — import and use directly. */
export const bootstrapTracer = new BootstrapTracer()
