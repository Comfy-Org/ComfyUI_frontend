import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { summarizeRafIntervals } from '@e2e/fixtures/helpers/rafMetrics'
import type {
  PerfMeasurement,
  PerfMeasurementResult
} from '@e2e/fixtures/utils/perfReportSchema'
import { perfReportSchema } from '@e2e/fixtures/utils/perfReportSchema'
import {
  recordMeasurement,
  writePerfReport
} from '@e2e/fixtures/utils/perfReporter'

function withTemporaryWorkingDirectory(run: () => void): void {
  const originalDirectory = process.cwd()
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'perf-reporter-'))
  process.chdir(temporaryDirectory)
  try {
    mkdirSync(join('test-results', 'perf-temp'), { recursive: true })
    run()
  } finally {
    process.chdir(originalDirectory)
    rmSync(temporaryDirectory, { force: true, recursive: true })
  }
}

function sample(rafIntervalP95Ms: number): PerfMeasurement {
  const rafIntervalsMs = [rafIntervalP95Ms]
  return {
    name: 'canvas-idle',
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
        hash: 'sha256:test',
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

describe('performance reporter', () => {
  it('preserves the result discriminant when recording', () => {
    withTemporaryWorkingDirectory(() => {
      const result: PerfMeasurementResult = {
        kind: 'rejected',
        reason: 'invalid window',
        measurement: sample(16.7)
      }

      expect(recordMeasurement(result)).toBe(result)
    })
  })

  it('fails when every recorded measurement is invalid', () => {
    withTemporaryWorkingDirectory(() => {
      writeFileSync(
        join('test-results', 'perf-temp', 'invalid.json'),
        JSON.stringify({ kind: 'accepted', measurement: { name: 'invalid' } })
      )

      expect(() => writePerfReport()).toThrow(
        'All 1 recorded performance measurements were invalid'
      )
    })
  })

  it('keeps both samples when one measurement name is recorded twice', () => {
    withTemporaryWorkingDirectory(() => {
      recordMeasurement({ kind: 'accepted', measurement: sample(16.7) })
      recordMeasurement({ kind: 'accepted', measurement: sample(33.4) })

      writePerfReport()

      const report = perfReportSchema.parse(
        JSON.parse(
          readFileSync(join('test-results', 'perf-metrics.json'), 'utf-8')
        )
      )
      expect(report.measurements).toHaveLength(2)
    })
  })

  it('writes schema version 3', () => {
    withTemporaryWorkingDirectory(() => {
      recordMeasurement({ kind: 'accepted', measurement: sample(16.7) })

      writePerfReport()

      const output: unknown = JSON.parse(
        readFileSync(join('test-results', 'perf-metrics.json'), 'utf-8')
      )
      expect(output).toMatchObject({ schemaVersion: 3 })
    })
  })

  it('keeps valid measurements when temp files contain invalid JSON', () => {
    withTemporaryWorkingDirectory(() => {
      recordMeasurement({ kind: 'accepted', measurement: sample(16.7) })
      writeFileSync(
        join('test-results', 'perf-temp', 'invalid.json'),
        '{not valid JSON'
      )

      expect(() => writePerfReport()).not.toThrow()
      const output: unknown = JSON.parse(
        readFileSync(join('test-results', 'perf-metrics.json'), 'utf-8')
      )
      const parsed = perfReportSchema.parse(output)
      expect(parsed.measurements).toHaveLength(1)
    })
  })
})
