import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
    rafIntervalsOver50Ms: 0
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
})

describe('performance report CLI gate', () => {
  const cliPath = fileURLToPath(import.meta.resolve('tsx/cli'))
  const reportPath = join(process.cwd(), 'scripts/perf-report.ts')

  it.for([
    {
      name: 'missing metrics with the flag',
      args: ['--fail-on-fps-budget'],
      rafIntervalP95Ms: null,
      expectedStatus: 1,
      expectedPassed: false
    },
    {
      name: 'below-budget metrics with the flag',
      args: ['--fail-on-fps-budget'],
      rafIntervalP95Ms: 25,
      expectedStatus: 1,
      expectedPassed: false
    },
    {
      name: 'passing metrics with the flag',
      args: ['--fail-on-fps-budget'],
      rafIntervalP95Ms: 16,
      expectedStatus: 0,
      expectedPassed: true
    },
    {
      name: 'below-budget metrics without the flag',
      args: [],
      rafIntervalP95Ms: 25,
      expectedStatus: 0,
      expectedPassed: false
    }
  ])('$name', ({ args, rafIntervalP95Ms, expectedStatus, expectedPassed }) => {
    const cwd = mkdtempSync(join(tmpdir(), 'perf-report-cli-'))
    try {
      if (rafIntervalP95Ms !== null) {
        mkdirSync(join(cwd, 'test-results'))
        writeFileSync(
          join(cwd, 'test-results/perf-metrics.json'),
          JSON.stringify(report([accepted(rafIntervalP95Ms)]))
        )
      }

      const result = spawnSync(
        process.execPath,
        [cliPath, reportPath, ...args],
        { cwd, encoding: 'utf8' }
      )

      expect(result.status).toBe(expectedStatus)
      const artifactPath = join(cwd, 'test-results/perf-gate.json')
      expect(existsSync(artifactPath)).toBe(true)
      expect(JSON.parse(readFileSync(artifactPath, 'utf8')).passed).toBe(
        expectedPassed
      )
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})
