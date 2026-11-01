/**
 * Structured performance tracing for the app startup/bootstrap sequence.
 *
 * Each phase maps to one of the known bottlenecks from profiling:
 *
 *   Phase                          | Typical range (cloud, Lighthouse)
 *   ───────────────────────────────┼──────────────────────────────────
 *   startup/entry-modules          | variable  (time origin → bootstrap(): HTML + static imports)
 *   startup/remote-config          | ~0–0.5 s  (pre-Firebase, blocking)
 *   startup/telemetry-init         | ~0–0.3 s
 *   startup/local-auth             | non-cloud (local web or desktop host session)
 *   startup/firebase-init          | ~0–0.1 s
 *   startup/router                 | ~0 s      (route table; cloud routes import)
 *   startup/sentry-init            | ~0–0.1 s
 *   auth-gate/initialized          | variable  (Firebase session restore + timeout/retry)
 *   auth-gate/user-store           | ~0–2.5 s  (GET /api/user/*)
 *   auth-gate/needs-login          | ~0 s      (computed resolution)
 *   bootstrap/settings             | ~0.2 s    (parallel, non-blocking)
 *   bootstrap/workflows            | ~0.3 s    (parallel, non-blocking)
 *   bootstrap/i18n                 | parallel  (custom node translations)
 *   bootstrap/graph-view-chunk     | variable  (lazy GraphView route import)
 *   bootstrap/new-user             | ~0 s      (new-user defaults)
 *   bootstrap/extensions-load      | ~0.5 s    (fetch + import /extensions JS)
 *     ├ extensions-load-core       | subset    (core entry-point import)
 *     └ extensions-load-custom     | subset    (backend-provided extension imports)
 *   bootstrap/deployment-pick      | cloud     (deployment lookup)
 *   bootstrap/sync-workflows       | ~0 s      (workflow store sync)
 *   bootstrap/extensions-init      | ~0.3 s    (extension.init() hooks)
 *   bootstrap/object-info          | ~0.7 s    (GET /api/object_info)
 *   bootstrap/extensions           | ~0.5 s    (addCustomNodeDefs + registerCustomNodes)
 *   bootstrap/vue-node-defs        | ~0.1 s    (node def store update)
 *   bootstrap/extensions-setup     | ~0.5 s    (extension.setup() hooks)
 *   bootstrap/workflow-restore     | ~0.3 s    (initial workflow, tabs, URL template)
 *
 * The two `extensions-load-*` rows are nested inside `extensions-load` rather
 * than replacing it: the aggregate stays intact for the existing monitors, and
 * the residual (aggregate minus both children) is `api.getExtensions()` plus
 * bookkeeping. So read the children and the residual against the aggregate —
 * never sum rows across the flattened phase map, which would double-count
 * extension load time.
 *
 * These children add two to `phase_count` when both run, so thresholds based
 * on the old count must shift. Each duration is rounded independently, so the
 * residual can be off by a millisecond or two in either direction and can read
 * negative on a fast load. The phase map carries only the rounded values.
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
import { useTelemetry } from '@comfyorg/telemetry'
import { getDatadogRum } from '@comfyorg/telemetry/rumContext'
import { TelemetryEvents } from '@comfyorg/telemetry/types'
import type { BootstrapCompleteMetadata } from '@comfyorg/telemetry/types'

import { perfMark, perfMeasureSinceOrigin, perfPoint } from './perfMark'
import type { PerfSpan } from './perfMark'

/**
 * Startup past this is abnormal by any reading — the slowest healthy cloud
 * load profiled is ~5 s, and the reports that prompted this instrumentation
 * were minutes.
 */
const BOOTSTRAP_WATCHDOG_MS = 30_000

function toRumTimingName(name: string): string {
  return name.replace(/\//g, '.')
}

const BOOTSTRAP_PHASES = {
  startup: [
    'entry-modules',
    'remote-config',
    'telemetry-init',
    'local-auth',
    'firebase-init',
    'router',
    'sentry-init'
  ],
  'auth-gate': ['initialized', 'user-store', 'needs-login'],
  bootstrap: [
    'settings',
    'workflows',
    'i18n',
    'graph-view-chunk',
    'new-user',
    'extensions-load',
    'extensions-load-core',
    'extensions-load-custom',
    'deployment-pick',
    'sync-workflows',
    'extensions-init',
    'object-info',
    'extensions',
    'vue-node-defs',
    'extensions-setup',
    'workflow-restore'
  ]
} as const satisfies Record<string, readonly string[]>

type BootstrapPhaseNamespace = keyof typeof BOOTSTRAP_PHASES

type BootstrapSubphase<Namespace extends BootstrapPhaseNamespace> =
  (typeof BOOTSTRAP_PHASES)[Namespace][number]

export type BootstrapPhase = {
  [Namespace in BootstrapPhaseNamespace]: `${Namespace}/${BootstrapSubphase<Namespace>}`
}[BootstrapPhaseNamespace]

function untracedMs(rows: BootstrapPhaseTiming[], totalMs: number): number {
  let tracedMs = 0
  let coveredUntil = 0
  for (const { startMs, durationMs } of rows) {
    const endMs = Math.min(startMs + durationMs, totalMs)
    tracedMs += Math.max(0, endMs - Math.max(startMs, coveredUntil))
    coveredUntil = Math.max(coveredUntil, endMs)
  }
  return totalMs - tracedMs
}

/**
 * Wall-clock time the document spends hidden during startup.
 *
 * Chromium throttles timers in a hidden tab and pauses animation frames, so a
 * start that began or moved to a background tab can run for minutes while no
 * one is waiting on it. Reporting the hidden share keeps those starts
 * distinguishable from slow starts a user watched, without dropping them.
 *
 * Time before the tracer exists is counted in the state seen at construction.
 */
class HiddenTimeMeter {
  private _hiddenMs = 0
  private _hiddenSince: number | undefined
  private _listening = new AbortController()

  constructor() {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'hidden') this._hiddenSince = 0
    document.addEventListener(
      'visibilitychange',
      () => {
        const now = performance.now()
        if (document.visibilityState === 'hidden') {
          this._hiddenSince ??= now
        } else if (this._hiddenSince !== undefined) {
          this._hiddenMs += now - this._hiddenSince
          this._hiddenSince = undefined
        }
      },
      { signal: this._listening.signal }
    )
  }

  stop(): void {
    this._listening.abort()
  }

  hiddenMsUntil(nowMs: number): number {
    const open = this._hiddenSince === undefined ? 0 : nowMs - this._hiddenSince
    return Math.round(this._hiddenMs + Math.max(0, open))
  }
}

export interface BootstrapPhaseTiming {
  name: BootstrapPhase
  startMs: number
  durationMs: number
}

export class BootstrapTracer {
  private _spans = new Map<BootstrapPhase, PerfSpan>()
  private _timings: BootstrapPhaseTiming[] = []
  private _completed = false
  private _outcome: 'completed' | 'failed' | undefined
  private _timeoutReported = false
  private _watchdog: ReturnType<typeof setTimeout> | undefined
  private _hidden = new HiddenTimeMeter()

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
    this._publishRumTiming(phase)
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
   * Record a phase that began at the navigation time origin, such as the
   * static module graph evaluated before any startup code can run.
   */
  recordSinceTimeOrigin(phase: BootstrapPhase): void {
    const durationMs = perfMeasureSinceOrigin(phase)
    this._publishRumTiming(phase)
    this._timings.push({
      name: phase,
      startMs: 0,
      durationMs: Math.round(durationMs)
    })
  }

  /**
   * Record a named milestone with no duration (e.g. "app shell mounted").
   */
  milestone(name: string): void {
    const milestoneName = `bootstrap/milestone/${name}`
    perfPoint(milestoneName)
    this._publishRumTiming(milestoneName)
  }

  private _publishRumTiming(name: string): void {
    getDatadogRum()?.addTiming(toRumTimingName(name))
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
   * `timed_out` is not terminal: startup can still finish after the watchdog
   * fires, and the outcome then becomes `completed` or `failed`.
   */
  get outcome(): 'completed' | 'failed' | 'timed_out' | 'pending' {
    return this._outcome ?? (this._timeoutReported ? 'timed_out' : 'pending')
  }

  /**
   * Close out startup: stop any phase still open, emit one aggregate event
   * carrying total wall-clock and the per-phase breakdown, and log the trace
   * locally. Idempotent — only the first call reports.
   */
  complete(outcome: 'completed' | 'failed' = 'completed'): void {
    if (this._completed) return
    this._completed = true
    this._outcome = outcome
    clearTimeout(this._watchdog)
    for (const phase of Array.from(this._spans.keys())) this._stopPhase(phase)
    this._report(outcome)
    this._hidden.stop()
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
    if (this._completed || this._timeoutReported) return
    this._watchdog = setTimeout(() => {
      if (this._completed || this._timeoutReported) return
      this._timeoutReported = true
      this._report('timed_out', [...this._spans.keys()])
    }, deadlineMs)
  }

  suspendWatchdog(): void {
    clearTimeout(this._watchdog)
    this._watchdog = undefined
  }

  resumeWatchdog(): void {
    if (!this._completed && this._watchdog === undefined) this.armWatchdog()
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
        untraced_ms: untracedMs(rows, totalMs),
        hidden_ms: this._hidden.hiddenMsUntil(totalMs),
        phases: Object.fromEntries(rows.map((r) => [r.name, r.durationMs])),
        ...(pending?.length ? { pending } : {})
      }
      getDatadogRum()?.addAction(TelemetryEvents.BOOTSTRAP_COMPLETE, metadata)
      useTelemetry()?.trackBootstrapComplete(metadata)
      if (outcome === 'completed') getDatadogRum()?.setViewLoadingTime()
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
        `\n  Total wall-clock: ${totalMs}ms` +
        `\n  Untraced: ${untracedMs(rows, totalMs)}ms`
    )
  }
}

/** Singleton tracer — import and use directly. */
export const bootstrapTracer = new BootstrapTracer()
