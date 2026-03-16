import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { MetricStats } from './perf-stats'
import {
  classifyChange,
  computeStats,
  formatSignificance,
  isNoteworthy,
  zScore
} from './perf-stats'

interface PerfMeasurement {
  name: string
  durationMs: number
  styleRecalcs: number
  styleRecalcDurationMs: number
  layouts: number
  layoutDurationMs: number
  taskDurationMs: number
  heapDeltaBytes: number
  domNodes: number
  jsHeapTotalBytes: number
  scriptDurationMs: number
  eventListeners: number
  totalBlockingTimeMs: number
  frameDurationMs: number
  fpsP5?: number
  fpsP50?: number
  fpsMean?: number
}

const M2_TARGET_FPS = 52
const M2_TARGET_TBT_MS = 200
const M2_TARGET_FRAME_DURATION_MS = 20
const M2_TEST_NAME = 'large-graph-idle'

interface PerfReport {
  timestamp: string
  gitSha: string
  branch: string
  measurements: PerfMeasurement[]
}

const CURRENT_PATH = 'test-results/perf-metrics.json'
const BASELINE_PATH = 'temp/perf-baseline/perf-metrics.json'
const HISTORY_DIR = 'temp/perf-history'

type MetricKey =
  | 'styleRecalcs'
  | 'layouts'
  | 'taskDurationMs'
  | 'domNodes'
  | 'scriptDurationMs'
  | 'eventListeners'
  | 'totalBlockingTimeMs'
  | 'frameDurationMs'
const REPORTED_METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: 'styleRecalcs', label: 'style recalcs', unit: '' },
  { key: 'layouts', label: 'layouts', unit: '' },
  { key: 'taskDurationMs', label: 'task duration', unit: 'ms' },
  { key: 'domNodes', label: 'DOM nodes', unit: '' },
  { key: 'scriptDurationMs', label: 'script duration', unit: 'ms' },
  { key: 'eventListeners', label: 'event listeners', unit: '' },
  { key: 'totalBlockingTimeMs', label: 'TBT', unit: 'ms' },
  { key: 'frameDurationMs', label: 'frame duration', unit: 'ms' }
]

function groupByName(
  measurements: PerfMeasurement[]
): Map<string, PerfMeasurement[]> {
  const map = new Map<string, PerfMeasurement[]>()
  for (const m of measurements) {
    const list = map.get(m.name) ?? []
    list.push(m)
    map.set(m.name, list)
  }
  return map
}

function loadHistoricalReports(): PerfReport[] {
  if (!existsSync(HISTORY_DIR)) return []
  const reports: PerfReport[] = []
  for (const dir of readdirSync(HISTORY_DIR)) {
    const filePath = join(HISTORY_DIR, dir, 'perf-metrics.json')
    if (!existsSync(filePath)) continue
    try {
      reports.push(JSON.parse(readFileSync(filePath, 'utf-8')) as PerfReport)
    } catch {
      console.warn(`Skipping malformed perf history: ${filePath}`)
    }
  }
  return reports
}

function getHistoricalStats(
  reports: PerfReport[],
  testName: string,
  metric: MetricKey
): MetricStats {
  const values: number[] = []
  for (const r of reports) {
    const group = groupByName(r.measurements)
    const samples = group.get(testName)
    if (samples) {
      const mean = meanMetric(samples, metric)
      if (mean !== null) values.push(mean)
    }
  }
  return computeStats(values)
}

function computeCV(stats: MetricStats): number {
  return stats.mean > 0 ? (stats.stddev / stats.mean) * 100 : 0
}

function formatValue(value: number, unit: string): string {
  return unit === 'ms' ? `${value.toFixed(0)}ms` : `${value.toFixed(0)}`
}

function formatDelta(pct: number | null): string {
  if (pct === null) return '—'
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}%`
}

function getMetricValue(
  sample: PerfMeasurement,
  key: MetricKey
): number | null {
  const value = sample[key]
  return Number.isFinite(value) ? value : null
}

function meanMetric(samples: PerfMeasurement[], key: MetricKey): number | null {
  const values = samples
    .map((s) => getMetricValue(s, key))
    .filter((v): v is number => v !== null)
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function formatBytes(bytes: number): string {
  if (Math.abs(bytes) < 1024) return `${bytes} B`
  if (Math.abs(bytes) < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function renderM2Scoreboard(
  prGroups: Map<string, PerfMeasurement[]>
): string[] {
  const samples = prGroups.get(M2_TEST_NAME)
  if (!samples?.length) return []

  const fpsValues = samples
    .map((s) => s.fpsP5)
    .filter((v): v is number => v != null && v > 0)
  if (fpsValues.length === 0) return []

  const avgP5 = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length
  const passed = avgP5 >= M2_TARGET_FPS
  const icon = passed ? '✅' : '🔴'
  const p50Values = samples
    .map((s) => s.fpsP50)
    .filter((v): v is number => v != null && v > 0)
  const avgP50 =
    p50Values.length > 0
      ? p50Values.reduce((a, b) => a + b, 0) / p50Values.length
      : null
  const meanValues = samples
    .map((s) => s.fpsMean)
    .filter((v): v is number => v != null && v > 0)
  const avgMean =
    meanValues.length > 0
      ? meanValues.reduce((a, b) => a + b, 0) / meanValues.length
      : null

  const tbtValues = samples.map((s) => s.totalBlockingTimeMs)
  const avgTBT = tbtValues.reduce((a, b) => a + b, 0) / tbtValues.length
  const tbtPassed = avgTBT <= M2_TARGET_TBT_MS
  const tbtIcon = tbtPassed ? '✅' : '🔴'

  const fdValues = samples.map((s) => s.frameDurationMs)
  const avgFD = fdValues.reduce((a, b) => a + b, 0) / fdValues.length
  const fdPassed = avgFD <= M2_TARGET_FRAME_DURATION_MS
  const fdIcon = fdPassed ? '✅' : '🔴'

  const allPassed = passed && tbtPassed && fdPassed

  const lines: string[] = [
    `### ${allPassed ? '✅' : '🔴'} M2 Perf Target — 245-node workflow`,
    '',
    `| Metric | Value | Target | Status |`,
    `|--------|-------|--------|--------|`,
    `| **P5 FPS** | **${avgP5.toFixed(0)}** | ≥${M2_TARGET_FPS} | ${icon} ${passed ? 'PASS' : 'FAIL'} |`,
    `| **TBT** | **${avgTBT.toFixed(0)}ms** | ≤${M2_TARGET_TBT_MS}ms | ${tbtIcon} ${tbtPassed ? 'PASS' : 'FAIL'} |`,
    `| **Frame Duration** | **${avgFD.toFixed(1)}ms** | ≤${M2_TARGET_FRAME_DURATION_MS}ms | ${fdIcon} ${fdPassed ? 'PASS' : 'FAIL'} |`
  ]
  if (avgP50 !== null) lines.push(`| P50 FPS | ${avgP50.toFixed(0)} | — | — |`)
  if (avgMean !== null)
    lines.push(`| Mean FPS | ${avgMean.toFixed(0)} | — | — |`)
  lines.push(
    `| Samples | ${fpsValues.length} | — | — |`,
    '',
    `> Legacy baseline: ~60 FPS idle, ~70 FPS zoom. Target = <25% regression.`,
    ''
  )
  return lines
}

function renderFullReport(
  prGroups: Map<string, PerfMeasurement[]>,
  baseline: PerfReport,
  historical: PerfReport[]
): string[] {
  const lines: string[] = []
  const baselineGroups = groupByName(baseline.measurements)
  const tableHeader = [
    '| Metric | Baseline | PR (n=3) | Δ | Sig |',
    '|--------|----------|----------|---|-----|'
  ]

  const flaggedRows: string[] = []
  const allRows: string[] = []

  for (const [testName, prSamples] of prGroups) {
    const baseSamples = baselineGroups.get(testName)

    for (const { key, label, unit } of REPORTED_METRICS) {
      const prMean = meanMetric(prSamples, key)
      if (prMean === null) continue
      const histStats = getHistoricalStats(historical, testName, key)
      const cv = computeCV(histStats)

      if (!baseSamples?.length) {
        allRows.push(
          `| ${testName}: ${label} | — | ${formatValue(prMean, unit)} | new | — |`
        )
        continue
      }

      const baseVal = meanMetric(baseSamples, key)
      if (baseVal === null) {
        allRows.push(
          `| ${testName}: ${label} | — | ${formatValue(prMean, unit)} | new | — |`
        )
        continue
      }
      const deltaPct =
        baseVal === 0
          ? prMean === 0
            ? 0
            : null
          : ((prMean - baseVal) / baseVal) * 100
      const z = zScore(prMean, histStats)
      const sig = classifyChange(z, cv)

      const row = `| ${testName}: ${label} | ${formatValue(baseVal, unit)} | ${formatValue(prMean, unit)} | ${formatDelta(deltaPct)} | ${formatSignificance(sig, z)} |`
      allRows.push(row)
      if (isNoteworthy(sig)) {
        flaggedRows.push(row)
      }
    }
  }

  if (flaggedRows.length > 0) {
    lines.push(
      `⚠️ **${flaggedRows.length} regression${flaggedRows.length > 1 ? 's' : ''} detected**`,
      '',
      ...tableHeader,
      ...flaggedRows,
      ''
    )
  } else {
    lines.push('No regressions detected.', '')
  }

  lines.push(
    `<details><summary>All metrics</summary>`,
    '',
    ...tableHeader,
    ...allRows,
    '',
    '</details>',
    ''
  )

  lines.push(
    `<details><summary>Historical variance (last ${historical.length} runs)</summary>`,
    '',
    '| Metric | μ | σ | CV |',
    '|--------|---|---|-----|'
  )
  for (const [testName] of prGroups) {
    for (const { key, label, unit } of REPORTED_METRICS) {
      const stats = getHistoricalStats(historical, testName, key)
      if (stats.n < 2) continue
      const cv = computeCV(stats)
      lines.push(
        `| ${testName}: ${label} | ${formatValue(stats.mean, unit)} | ${formatValue(stats.stddev, unit)} | ${cv.toFixed(1)}% |`
      )
    }
  }
  lines.push('', '</details>')

  return lines
}

function renderColdStartReport(
  prGroups: Map<string, PerfMeasurement[]>,
  baseline: PerfReport,
  historicalCount: number
): string[] {
  const lines: string[] = []
  const baselineGroups = groupByName(baseline.measurements)
  lines.push(
    `> ℹ️ Collecting baseline variance data (${historicalCount}/5 runs). Significance will appear after 2 main branch runs.`,
    '',
    '| Metric | Baseline | PR | Δ |',
    '|--------|----------|-----|---|'
  )

  for (const [testName, prSamples] of prGroups) {
    const baseSamples = baselineGroups.get(testName)

    for (const { key, label, unit } of REPORTED_METRICS) {
      const prMean = meanMetric(prSamples, key)
      if (prMean === null) continue

      if (!baseSamples?.length) {
        lines.push(
          `| ${testName}: ${label} | — | ${formatValue(prMean, unit)} | new |`
        )
        continue
      }

      const baseVal = meanMetric(baseSamples, key)
      if (baseVal === null) {
        lines.push(
          `| ${testName}: ${label} | — | ${formatValue(prMean, unit)} | new |`
        )
        continue
      }
      const deltaPct =
        baseVal === 0
          ? prMean === 0
            ? 0
            : null
          : ((prMean - baseVal) / baseVal) * 100
      lines.push(
        `| ${testName}: ${label} | ${formatValue(baseVal, unit)} | ${formatValue(prMean, unit)} | ${formatDelta(deltaPct)} |`
      )
    }
  }

  return lines
}

function renderNoBaselineReport(
  prGroups: Map<string, PerfMeasurement[]>
): string[] {
  const lines: string[] = []
  lines.push(
    'No baseline found — showing absolute values.\n',
    '| Metric | Value |',
    '|--------|-------|'
  )
  for (const [testName, prSamples] of prGroups) {
    for (const { key, label, unit } of REPORTED_METRICS) {
      const prMean = meanMetric(prSamples, key)
      if (prMean === null) continue
      lines.push(`| ${testName}: ${label} | ${formatValue(prMean, unit)} |`)
    }
    const heapMean =
      prSamples.reduce((sum, s) => sum + (s.heapDeltaBytes ?? 0), 0) /
      prSamples.length
    lines.push(`| ${testName}: heap delta | ${formatBytes(heapMean)} |`)
  }
  return lines
}

function main() {
  if (!existsSync(CURRENT_PATH)) {
    process.stdout.write(
      '## ⚡ Performance Report\n\nNo perf metrics found. Perf tests may not have run.\n'
    )
    process.exit(0)
  }

  const current: PerfReport = JSON.parse(readFileSync(CURRENT_PATH, 'utf-8'))

  const baseline: PerfReport | null = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
    : null

  const historical = loadHistoricalReports()
  const prGroups = groupByName(current.measurements)

  const lines: string[] = []
  lines.push('## ⚡ Performance Report\n')

  lines.push(...renderM2Scoreboard(prGroups))

  if (baseline && historical.length >= 2) {
    lines.push(...renderFullReport(prGroups, baseline, historical))
  } else if (baseline) {
    lines.push(...renderColdStartReport(prGroups, baseline, historical.length))
  } else {
    lines.push(...renderNoBaselineReport(prGroups))
  }

  lines.push('\n<details><summary>Raw data</summary>\n')
  lines.push('```json')
  lines.push(JSON.stringify(current, null, 2))
  lines.push('```')
  lines.push('\n</details>')

  process.stdout.write(lines.join('\n') + '\n')
}

main()
