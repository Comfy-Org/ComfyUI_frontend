import { randomUUID } from 'crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import type {
  PerfMeasurement,
  PerfMeasurementResult,
  PerfReportV3
} from '@e2e/fixtures/utils/perfReportSchema'
import { perfMeasurementResultSchema } from '@e2e/fixtures/utils/perfReportSchema'

const TEMP_DIR = join('test-results', 'perf-temp')

type MeasurementField = keyof PerfMeasurement

const FIELD_FORMATTERS: Record<string, (m: PerfMeasurement) => string> = {
  styleRecalcs: (m) => `${m.styleRecalcs} recalcs`,
  layouts: (m) => `${m.layouts} layouts`,
  taskDurationMs: (m) => `${m.taskDurationMs.toFixed(1)}ms task`,
  layoutDurationMs: (m) => `${m.layoutDurationMs.toFixed(1)}ms layout`,
  rafIntervalP95Ms: (m) => `${m.rafIntervalP95Ms.toFixed(1)}ms rAF p95`,
  rafIntervalMaxMs: (m) => `${m.rafIntervalMaxMs.toFixed(1)}ms rAF max`,
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

export function recordMeasurement(
  result: PerfMeasurementResult
): PerfMeasurement {
  mkdirSync(TEMP_DIR, { recursive: true })
  const filename = `${result.measurement.name}-${Date.now()}-${randomUUID()}.json`
  writeFileSync(join(TEMP_DIR, filename), JSON.stringify(result))
  return result.measurement
}

export function writePerfReport(
  gitSha = process.env.GITHUB_SHA ?? 'local',
  branch = process.env.GITHUB_HEAD_REF ?? 'local'
) {
  let entries
  try {
    entries = readdirSync('test-results', { withFileTypes: true })
  } catch {
    return
  }
  if (!entries.length) return

  let tempFiles: string[]
  try {
    tempFiles = readdirSync(TEMP_DIR).filter((f) => f.endsWith('.json'))
  } catch {
    return
  }
  if (tempFiles.length === 0) return

  const measurements = tempFiles.flatMap((file) => {
    try {
      const value: unknown = JSON.parse(
        readFileSync(join(TEMP_DIR, file), 'utf-8')
      )
      return [perfMeasurementResultSchema.parse(value)]
    } catch {
      return []
    }
  })
  if (measurements.length === 0) {
    throw new Error(
      `All ${tempFiles.length} recorded performance measurements were invalid`
    )
  }

  const report: PerfReportV3 = {
    schemaVersion: 3,
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
