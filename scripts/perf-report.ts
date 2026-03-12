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
}

interface PerfReport {
  timestamp: string
  gitSha: string
  branch: string
  measurements: PerfMeasurement[]
}

const CURRENT_PATH = 'test-results/perf-metrics.json'
const BASELINE_PATH = 'temp/perf-baseline/perf-metrics.json'
const HISTORY_DIR = 'temp/perf-history'

type MetricKey = 'styleRecalcs' | 'layouts' | 'taskDurationMs'
const REPORTED_METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: 'styleRecalcs', label: 'style recalcs', unit: '' },
  { key: 'layouts', label: 'layouts', unit: '' },
  { key: 'taskDurationMs', label: 'task duration', unit: 'ms' }
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
      const mean =
        samples.reduce((sum, s) => sum + s[metric], 0) / samples.length
      values.push(mean)
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

function meanMetric(samples: PerfMeasurement[], key: MetricKey): number {
  return samples.reduce((sum, s) => sum + s[key], 0) / samples.length
}

function formatBytes(bytes: number): string {
  if (Math.abs(bytes) < 1024) return `${bytes} B`
  if (Math.abs(bytes) < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
      const prValues = prSamples.map((s) => s[key])
      const prMean = prValues.reduce((a, b) => a + b, 0) / prValues.length
      const histStats = getHistoricalStats(historical, testName, key)
      const cv = computeCV(histStats)

      if (!baseSamples?.length) {
        allRows.push(
          `| ${testName}: ${label} | — | ${formatValue(prMean, unit)} | new | — |`
        )
        continue
      }

      const baseVal = meanMetric(baseSamples, key)
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
      const prValues = prSamples.map((s) => s[key])
      const prMean = prValues.reduce((a, b) => a + b, 0) / prValues.length

      if (!baseSamples?.length) {
        lines.push(
          `| ${testName}: ${label} | — | ${formatValue(prMean, unit)} | new |`
        )
        continue
      }

      const baseVal = meanMetric(baseSamples, key)
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
    const prMean = (key: MetricKey) =>
      prSamples.reduce((sum, s) => sum + s[key], 0) / prSamples.length

    lines.push(
      `| ${testName}: style recalcs | ${prMean('styleRecalcs').toFixed(0)} |`
    )
    lines.push(`| ${testName}: layouts | ${prMean('layouts').toFixed(0)} |`)
    lines.push(
      `| ${testName}: task duration | ${prMean('taskDurationMs').toFixed(0)}ms |`
    )
    const heapMean =
      prSamples.reduce((sum, s) => sum + s.heapDeltaBytes, 0) / prSamples.length
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
