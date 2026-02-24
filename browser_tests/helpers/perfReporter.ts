import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

import type { PerfMeasurement } from '../fixtures/helpers/PerformanceHelper'

export interface PerfReport {
  timestamp: string
  gitSha: string
  branch: string
  measurements: PerfMeasurement[]
}

const measurements: PerfMeasurement[] = []

export function recordMeasurement(m: PerfMeasurement) {
  measurements.push(m)
}

export function writePerfReport() {
  if (measurements.length === 0) return

  mkdirSync('test-results', { recursive: true })
  const report: PerfReport = {
    timestamp: new Date().toISOString(),
    gitSha: process.env.GITHUB_SHA ?? 'local',
    branch: process.env.GITHUB_HEAD_REF ?? 'local',
    measurements
  }
  writeFileSync(
    join('test-results', 'perf-metrics.json'),
    JSON.stringify(report, null, 2)
  )
}
