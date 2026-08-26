/**
 * Pass/fail decision for the perf suite.
 *
 * Kept separate from `perf-report.ts` so the decision is unit-testable without a
 * metrics file, a baseline, or a CI checkout: `perf-report.ts` renders, this
 * decides.
 *
 * The gate deliberately asserts only the **absolute** P5 FPS budget. The
 * report's z-score regression rows are relative to `temp/perf-history`, which is
 * populated from the `perf-data` branch — and that branch has not been written
 * to since 2026-03-17 (see issue #15545). Gating on a comparison against a
 * five-month-old distribution would fail almost every PR for drift rather than
 * for a regression, so the regression count is reported and recorded here but is
 * not a failure condition.
 */

/** Target: P5 FPS >= 52, i.e. a 95th-percentile frame no slower than ~19.2ms. */
export const TARGET_P5_FPS = 52

export interface FpsSample {
  testName: string
  /** null when the run produced no p95 frame-duration samples for this test. */
  p5Fps: number | null
}

export interface PerfGateInput {
  /** True when the metrics file was present and parsed. */
  metricsPresent: boolean
  fpsSamples: FpsSample[]
  /** Rows the report classified as regressions. Recorded, never gated on. */
  regressionCount: number
}

export type PerfGateFailure =
  | { kind: 'no-metrics' }
  | { kind: 'no-measurements' }
  | {
      kind: 'fps-below-target'
      testName: string
      p5Fps: number
      target: number
    }

export interface PerfGateResult {
  failures: PerfGateFailure[]
  /** Number of tests that produced a usable P5 FPS value. */
  evaluated: number
  regressionCount: number
  target: number
  passed: boolean
}

/**
 * A run that measured nothing fails. Without that rule the gate is green by
 * construction whenever the perf suite dies before recording a sample, which is
 * the exact failure mode it exists to catch.
 */
export function evaluatePerfGate(input: PerfGateInput): PerfGateResult {
  const target = TARGET_P5_FPS

  if (!input.metricsPresent) {
    return {
      failures: [{ kind: 'no-metrics' }],
      evaluated: 0,
      regressionCount: input.regressionCount,
      target,
      passed: false
    }
  }

  const usable = input.fpsSamples.filter(
    (s): s is { testName: string; p5Fps: number } =>
      s.p5Fps !== null && Number.isFinite(s.p5Fps)
  )

  const failures: PerfGateFailure[] = []
  if (usable.length === 0) failures.push({ kind: 'no-measurements' })

  for (const s of usable) {
    if (s.p5Fps < target) {
      failures.push({
        kind: 'fps-below-target',
        testName: s.testName,
        p5Fps: s.p5Fps,
        target
      })
    }
  }

  return {
    failures,
    evaluated: usable.length,
    regressionCount: input.regressionCount,
    target,
    passed: failures.length === 0
  }
}

export function formatGateFailure(failure: PerfGateFailure): string {
  switch (failure.kind) {
    case 'no-metrics':
      return 'no perf metrics file — the perf suite produced nothing to gate on'
    case 'no-measurements':
      return 'perf metrics file contains no usable p95 frame-time samples'
    case 'fps-below-target':
      return `${failure.testName}: ${failure.p5Fps.toFixed(1)} P5 FPS is below the target of ${failure.target}`
  }
}
