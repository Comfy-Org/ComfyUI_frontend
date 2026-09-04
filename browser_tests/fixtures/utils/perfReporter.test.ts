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

import type { PerfMeasurement } from '@e2e/fixtures/utils/perfReportSchema'
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
})
