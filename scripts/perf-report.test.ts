import { describe, expect, it } from 'vitest'

import type {
  PerfMeasurement,
  PerfMeasurementResult,
  PerfReportV2
} from '../browser_tests/fixtures/utils/perfReportSchema'
import { perfReportSchema } from '../browser_tests/fixtures/utils/perfReportSchema'
import { renderPerfReport } from './perf-report'

function measurement(name: string, rafIntervalP95Ms: number): PerfMeasurement {
  return {
    name,
    durationMs: 0,
    styleRecalcs: 0,
    styleRecalcDurationMs: 0,
    layouts: 0,
    layoutDurationMs: 0,
    taskDurationMs: 0,
    taskOtherDurationMs: 0,
    v8CompileDurationMs: 0,
    devToolsCommandDurationMs: 0,
    threadTimeMs: 0,
    processTimeMs: 0,
    accountedTaskDurationMs: 0,
    taskAccountingResidualMs: 0,
    missingCdpMetrics: [],
    nonMonotonicCdpMetrics: [],
    heapDeltaBytes: 0,
    heapUsedBytes: 0,
    domNodes: 0,
    jsHeapTotalBytes: 0,
    scriptDurationMs: 0,
    eventListeners: 0,
    totalBlockingTimeMs: 0,
    rafIntervalsMs: [rafIntervalP95Ms],
    rafIntervalCount: 1,
    rafIntervalP50Ms: rafIntervalP95Ms,
    rafIntervalP95Ms,
    rafIntervalP99Ms: rafIntervalP95Ms,
    rafIntervalMaxMs: rafIntervalP95Ms,
    rafIntervalsOver8_33Ms: 0,
    rafIntervalsOver16_67Ms: 0,
    rafIntervalsOver33_3Ms: 0,
    rafIntervalsOver50Ms: 0,
    workloadIdentity: {
      schemaVersion: 1,
      topology: {
        hash: 'sha256:test',
        nodes: 1,
        visibleNodes: 1,
        inputs: 0,
        outputs: 0,
        links: 0,
        maxFanOut: 0,
        widgets: 0
      },
      activity: {
        activeProgressEntries: null,
        progressEventsEmitted: null,
        progressEventsReceived: null,
        progressEventsApplied: null,
        dirtyReasons: null,
        foregroundDraws: null,
        backgroundDraws: null
      },
      environment: {
        renderer: 'legacy',
        canvasInfoEnabled: null,
        viewportWidth: 1280,
        viewportHeight: 720,
        devicePixelRatio: 1,
        frontendVersion: 'test',
        frontendCommit: 'test',
        buildMode: 'test',
        browserVersion: 'test',
        gpuClass: 'unknown'
      },
      missingOptionalFields: []
    }
  }
}

function accepted(value: number): PerfMeasurementResult {
  return { kind: 'accepted', measurement: measurement('sample', value) }
}

function rejected(value: number): PerfMeasurementResult {
  return {
    kind: 'rejected',
    reason: 'visibility changed',
    measurement: measurement('sample', value)
  }
}

function report(measurements: PerfMeasurementResult[]): PerfReportV2 {
  return {
    schemaVersion: 2,
    timestamp: '2026-08-26T00:00:00.000Z',
    gitSha: 'abc123',
    branch: 'test',
    measurements
  }
}

describe('performance report', () => {
  it('excludes rejected current, baseline, and historical samples', () => {
    const output = renderPerfReport(
      report([accepted(20), rejected(1_000)]),
      report([accepted(10), rejected(2_000)]),
      [
        report([accepted(10), rejected(3_000)]),
        report([accepted(10), rejected(4_000)])
      ]
    )

    expect(output).toContain(
      '| sample: rAF interval p95 | 10ms | 20ms | +100% |'
    )
    expect(output).toContain(
      '1 measurement rejected and excluded from all statistics'
    )
  })

  it('does not calculate a verdict when every current sample is rejected', () => {
    const output = renderPerfReport(report([rejected(1_000)]), null, [])

    expect(output).toContain('No regression verdict was calculated')
    expect(output).not.toContain('No regressions detected')
  })

  it('starts a new epoch for a v1 baseline', () => {
    const output = renderPerfReport(
      report([accepted(20)]),
      {
        timestamp: '2026-08-25T00:00:00.000Z',
        gitSha: 'old',
        branch: 'main',
        measurements: []
      },
      []
    )

    expect(output).toContain(
      'Baseline schema v1 is not comparable with current schema v2'
    )
  })

  it('rejects malformed v2 reports at the boundary', () => {
    expect(
      perfReportSchema.safeParse({
        ...report([accepted(20)]),
        measurements: [{ kind: 'accepted', measurement: { name: 'sample' } }]
      }).success
    ).toBe(false)
  })

  it('preserves accounting and identity on rejected results', () => {
    const input = report([rejected(20)])
    const parsed = perfReportSchema.parse(input)

    expect(parsed).toEqual(input)
  })
})
