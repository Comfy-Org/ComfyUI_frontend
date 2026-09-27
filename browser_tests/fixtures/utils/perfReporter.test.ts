import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import type { PerfMeasurement } from '@e2e/fixtures/utils/perfReportSchema'
import { recordMeasurement } from '@e2e/fixtures/utils/perfReporter'

const TEMP_DIR = join('test-results', 'perf-temp')

function readRecordedResults(): unknown[] {
  if (!existsSync(TEMP_DIR)) return []
  return readdirSync(TEMP_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(join(TEMP_DIR, file), 'utf-8')))
}

function measurementNamed(name: string): PerfMeasurement {
  return {
    name,
    durationMs: 1,
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
    rafIntervalsMs: [],
    rafIntervalCount: 0,
    rafIntervalP50Ms: 0,
    rafIntervalP95Ms: 0,
    rafIntervalP99Ms: 0,
    rafIntervalMaxMs: 0,
    rafIntervalsOver8_33Ms: 0,
    rafIntervalsOver16_67Ms: 0,
    rafIntervalsOver33_3Ms: 0,
    rafIntervalsOver50Ms: 0
  }
}

describe('recordMeasurement', () => {
  afterEach(() => {
    rmSync(TEMP_DIR, { recursive: true, force: true })
  })

  it('fails the calling test when the measurement was rejected', () => {
    expect(() =>
      recordMeasurement({
        kind: 'rejected',
        reason: 'rAF stop boundary timed out',
        measurement: measurementNamed('rejected-run')
      })
    ).toThrow('rAF stop boundary timed out')
  })

  it('preserves the rejected result on disk before throwing', () => {
    expect(() =>
      recordMeasurement({
        kind: 'rejected',
        reason: 'rAF stop boundary timed out',
        measurement: measurementNamed('rejected-run')
      })
    ).toThrow()

    expect(readRecordedResults()).toEqual([
      {
        kind: 'rejected',
        reason: 'rAF stop boundary timed out',
        measurement: measurementNamed('rejected-run')
      }
    ])
  })

  it('returns the measurement when it was accepted', () => {
    const measurement = measurementNamed('accepted-run')

    expect(recordMeasurement({ kind: 'accepted', measurement })).toEqual(
      measurement
    )
  })
})
