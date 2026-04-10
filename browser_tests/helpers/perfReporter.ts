import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import type { PerfMeasurement } from '@e2e/fixtures/helpers/PerformanceHelper'

export interface PerfReport {
  timestamp: string
  gitSha: string
  branch: string
  measurements: PerfMeasurement[]
}

const TEMP_DIR = join('test-results', 'perf-temp')

type MeasurementField = keyof PerfMeasurement

const FIELD_FORMATTERS: Record<string, (m: PerfMeasurement) => string> = {
  styleRecalcs: (m) => `${m.styleRecalcs} recalcs`,
  layouts: (m) => `${m.layouts} layouts`,
  taskDurationMs: (m) => `${m.taskDurationMs.toFixed(1)}ms task`,
  layoutDurationMs: (m) => `${m.layoutDurationMs.toFixed(1)}ms layout`,
  frameDurationMs: (m) => `${m.frameDurationMs.toFixed(1)}ms/frame`,
  totalBlockingTimeMs: (m) => `TBT=${m.totalBlockingTimeMs.toFixed(0)}ms`,
  durationMs: (m) => `${m.durationMs.toFixed(0)}ms total`,
  heapDeltaBytes: (m) => `heap Δ${(m.heapDeltaBytes / 1024).toFixed(0)}KB`,
  domNodes: (m) => `DOM Δ${m.domNodes}`,
  heapUsedBytes: (m) => `heap ${(m.heapUsedBytes / 1024 / 1024).toFixed(1)}MB`
}

/**
 * Log a perf measurement to the console in a consistent format.
 * Fields are formatted automatically based on their type.
 */
export function logMeasurement(
  label: string,
  m: PerfMeasurement,
  fields: MeasurementField[]
) {
  const parts = fields.map((f) => {
    const formatter = FIELD_FORMATTERS[f]
    if (formatter) return formatter(m)
    return `${f}=${m[f]}`
  })
  // oxlint-disable-next-line no-console -- perf reporter intentionally logs to stdout
  console.log(`${label}: ${parts.join(', ')}`)
}

export function recordMeasurement(m: PerfMeasurement) {
  mkdirSync(TEMP_DIR, { recursive: true })
  const filename = `${m.name}-${Date.now()}.json`
  const { allFrameDurationsMs: _, ...serializable } = m
  writeFileSync(join(TEMP_DIR, filename), JSON.stringify(serializable))
}

export function writePerfReport(
  gitSha = process.env.GITHUB_SHA ?? 'local',
  branch = process.env.GITHUB_HEAD_REF ?? 'local'
) {
  if (!readdirSync('test-results', { withFileTypes: true }).length) return

  let tempFiles: string[]
  try {
    tempFiles = readdirSync(TEMP_DIR).filter((f) => f.endsWith('.json'))
  } catch {
    return
  }
  if (tempFiles.length === 0) return

  const measurements: PerfMeasurement[] = tempFiles.map((f) =>
    JSON.parse(readFileSync(join(TEMP_DIR, f), 'utf-8'))
  )

  const report: PerfReport = {
    timestamp: new Date().toISOString(),
    gitSha,
    branch,
    measurements
  }
  writeFileSync(
    join('test-results', 'perf-metrics.json'),
    JSON.stringify(report, null, 2)
  )
}
