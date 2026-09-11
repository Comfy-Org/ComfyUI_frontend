import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import type {
  PerfMeasurement,
  PerfMeasurementResult,
  PerfReport,
  PerfReportV3
} from '../browser_tests/fixtures/utils/perfReportSchema'
import {
  perfMeasurementResultSchema,
  perfReportSchema
} from '../browser_tests/fixtures/utils/perfReportSchema'
import { summarizeRafIntervals } from '../browser_tests/fixtures/helpers/rafMetrics'
import { renderPerfReport } from './perf-report'

function measurement(
  name: string,
  rafIntervalP95Ms: number,
  topologyHash = 'sha256:test'
): PerfMeasurement {
  const rafIntervalsMs = [rafIntervalP95Ms]
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
    invalidCdpMetrics: [],
    heapDeltaBytes: 0,
    heapUsedBytes: 0,
    domNodes: 0,
    jsHeapTotalBytes: 0,
    scriptDurationMs: 0,
    eventListeners: 0,
    totalBlockingTimeMs: 0,
    rafIntervalsMs,
    ...summarizeRafIntervals(rafIntervalsMs),
    workloadIdentity: {
      schemaVersion: 1,
      topology: {
        hash: topologyHash,
        nodes: 1,
        visibleNodes: 1,
        inputs: 0,
        outputs: 0,
        links: 0,
        maxFanOut: 0,
        widgets: 0
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
      }
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

function report(measurements: PerfMeasurementResult[]): PerfReportV3 {
  return {
    schemaVersion: 3,
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
    expect(output).toContain('| sample: rAF interval p95 | 10ms | 0ms | 0.0% |')
    expect(output).not.toContain('3500ms')
    expect(output).toContain(
      '1 measurement rejected and excluded from all statistics'
    )
  })

  it('does not calculate a verdict when every current sample is rejected', () => {
    const output = renderPerfReport(report([rejected(1_000)]), null, [])

    expect(output).toContain('No regression verdict was calculated')
    expect(output).not.toContain('No regressions detected')
  })

  it('rejects current samples with mixed workload identities', () => {
    const incompatibleMeasurement = measurement('sample', 100)
    const incompatible: PerfMeasurementResult = {
      kind: 'accepted',
      measurement: {
        ...incompatibleMeasurement,
        workloadIdentity: {
          ...incompatibleMeasurement.workloadIdentity,
          topology: {
            ...incompatibleMeasurement.workloadIdentity.topology,
            hash: 'sha256:different'
          }
        }
      }
    }

    const output = renderPerfReport(
      report([accepted(10), incompatible]),
      report([accepted(10)]),
      []
    )

    expect(output).toContain(
      'sample rejected because its current samples have mixed workload identities'
    )
    expect(output).toContain('No regression verdict was calculated')
    expect(output).not.toContain('55ms')
  })

  it('reports CDP task accounting metrics', () => {
    const output = renderPerfReport(report([accepted(20)]), null, [])

    for (const label of [
      'task other duration',
      'V8 compile duration',
      'DevTools command duration',
      'thread time',
      'process time',
      'accounted task duration',
      'task accounting residual'
    ]) {
      expect(output).toContain(`| sample: ${label} |`)
    }
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
      'Baseline schema v1 is not comparable with current schema v3'
    )
  })

  it('parses a pre-change v2 report as a new measurement epoch', () => {
    const fixture: unknown = JSON.parse(
      readFileSync(resolve('scripts/fixtures/perf-report-v2.json'), 'utf-8')
    )
    const parsed = perfReportSchema.parse(fixture)

    expect(parsed.schemaVersion).toBe(2)
    if (parsed.schemaVersion !== 2)
      throw new Error('Expected schema v2 fixture')
    expect(renderPerfReport(report([accepted(20)]), parsed, [])).toContain(
      'Baseline schema v2 is not comparable with current schema v3'
    )
    expect(
      perfReportSchema.safeParse({ ...parsed, schemaVersion: 3 }).success
    ).toBe(false)
  })

  it('rejects malformed v3 reports at the boundary', () => {
    expect(
      perfReportSchema.safeParse({
        ...report([accepted(20)]),
        measurements: [{ kind: 'accepted', measurement: { name: 'sample' } }]
      }).success
    ).toBe(false)
  })

  it('rejects accepted results with invalid or inconsistent raw intervals', () => {
    const emptyIntervals = accepted(20)
    emptyIntervals.measurement.rafIntervalsMs = []
    const inconsistentSummary = accepted(20)
    inconsistentSummary.measurement.rafIntervalP95Ms = 10

    expect(perfMeasurementResultSchema.safeParse(emptyIntervals).success).toBe(
      false
    )
    expect(
      perfMeasurementResultSchema.safeParse(inconsistentSummary).success
    ).toBe(false)
  })

  it('preserves accounting and identity on rejected results', () => {
    const input = report([rejected(20)])
    const parsed = perfReportSchema.parse(input)

    expect(parsed).toEqual(input)
  })

  it('preserves rejected results with serialized non-finite rAF values', () => {
    const serialized: unknown = JSON.parse(JSON.stringify(rejected(Number.NaN)))

    const parsed = perfMeasurementResultSchema.parse(serialized)

    expect(parsed.kind).toBe('rejected')
    expect(parsed.measurement.rafIntervalP95Ms).toBeNull()
    expect(parsed.measurement.rafIntervalsMs[0]).toBeNull()
  })

  it('escapes artifact-controlled text in rendered Markdown', () => {
    const hostileName = '@everyone | **owned** <img src=x>\n# heading'
    const hostileReason = '@octocat | [link](https://example.com) </details>'
    const output = renderPerfReport(
      report([
        {
          kind: 'rejected',
          reason: hostileReason,
          measurement: measurement(hostileName, 20)
        }
      ]),
      null,
      []
    )
    const renderedReport = output.split(
      '<details><summary>Summary data</summary>'
    )[0]

    expect(renderedReport).not.toContain(hostileName)
    expect(renderedReport).not.toContain(hostileReason)
    expect(renderedReport).not.toContain('@everyone')
    expect(renderedReport).not.toContain('@octocat')
    expect(renderedReport).not.toContain('<img')
    expect(renderedReport).not.toContain('</details> |')
    expect(renderedReport).not.toContain('\n# heading')
  })

  it('excludes incompatible v3 baseline and history by workload identity', () => {
    const incompatible = (value: number): PerfMeasurementResult => ({
      kind: 'accepted',
      measurement: measurement('sample', value, 'sha256:other')
    })
    const output = renderPerfReport(
      report([accepted(20)]),
      report([incompatible(1_000)]),
      [
        report([accepted(10), incompatible(2_000)]),
        report([accepted(30), incompatible(3_000)])
      ]
    )

    expect(output).toContain(
      '| sample: rAF interval p95 | — | 20ms | new | — |'
    )
    expect(output).toContain(
      '| sample: rAF interval p95 | 20ms | 14ms | 70.7% |'
    )
    expect(output).not.toContain('1000ms')
    expect(output).not.toContain('2500ms')
  })

  it('ignores old-schema history when calculating v3 variance', () => {
    const current = report([accepted(20)])
    const baseline = report([accepted(20)])
    const v3History = [report([accepted(10)]), report([accepted(30)])]
    const oldHistory: PerfReport = {
      timestamp: '2026-08-20T00:00:00.000Z',
      gitSha: 'old',
      branch: 'main',
      measurements: [{ arbitrary: 'old schema data' }]
    }

    expect(
      renderPerfReport(current, baseline, [...v3History, oldHistory])
    ).toBe(renderPerfReport(current, baseline, v3History))
  })

  it('bounds the entire report for many rejections and reports omissions', () => {
    const measurementCount = 2_000
    const output = renderPerfReport(
      report(
        Array.from({ length: measurementCount }, (_, index) => ({
          kind: 'rejected',
          reason: `rejection-${index}`,
          measurement: measurement(`sample-${index}`, 20)
        }))
      ),
      null,
      []
    )

    expect(output.length).toBeLessThanOrEqual(48_000)
    expect(output).toMatch(/\d+ rejected measurements? (?:omitted|truncated)/i)
  })

  it('bounds fallback summary data and reports omitted measurements', () => {
    const measurementCount = 2_000
    const output = renderPerfReport(
      report(Array.from({ length: measurementCount }, () => accepted(20))),
      null,
      []
    )
    const summaryData = output.match(/```json\n([\s\S]*?)\n```/)?.[1]

    expect(summaryData).toBeDefined()
    expect(summaryData?.length).toBeLessThanOrEqual(48_000)
    const summary: unknown = JSON.parse(summaryData ?? '')
    expect(summary).toMatchObject({
      summaryTruncated: true,
      measurementCount
    })
    expect(summary).toHaveProperty('measurementIdentities')
    if (
      typeof summary !== 'object' ||
      summary === null ||
      !('measurementIdentities' in summary) ||
      !Array.isArray(summary.measurementIdentities)
    ) {
      throw new Error('Expected measurement identities in fallback summary')
    }
    expect(summary.measurementIdentities.length).toBeLessThan(measurementCount)
  })
})
