import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { MetricStats } from './perf-stats'
import {
  classifyChange,
  computeStats,
  formatSignificance,
  isNoteworthy,
  sparkline,
  trendArrow,
  trendDirection,
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
  heapUsedBytes: number
  domNodes: number
  jsHeapTotalBytes: number
  scriptDurationMs: number
  eventListeners: number
  totalBlockingTimeMs: number
  frameDurationMs: number
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

type MetricKey =
  | 'styleRecalcs'
  | 'styleRecalcDurationMs'
  | 'layouts'
  | 'layoutDurationMs'
  | 'taskDurationMs'
  | 'domNodes'
  | 'scriptDurationMs'
  | 'eventListeners'
  | 'totalBlockingTimeMs'
  | 'frameDurationMs'
  | 'heapUsedBytes'

interface MetricDef {
  key: MetricKey
  label: string
  unit: string
  /** Minimum absolute delta to consider meaningful (effect size gate) */
  minAbsDelta?: number
}

const REPORTED_METRICS: MetricDef[] = [
  { key: 'layoutDurationMs', label: 'layout duration', unit: 'ms' },
  {
    key: 'styleRecalcDurationMs',
    label: 'style recalc duration',
    unit: 'ms'
  },
  { key: 'layouts', label: 'layout count', unit: '', minAbsDelta: 5 },
  {
    key: 'styleRecalcs',
    label: 'style recalc count',
    unit: '',
    minAbsDelta: 5
  },
  { key: 'taskDurationMs', label: 'task duration', unit: 'ms' },
  { key: 'scriptDurationMs', label: 'script duration', unit: 'ms' },
  { key: 'totalBlockingTimeMs', label: 'TBT', unit: 'ms' },
  { key: 'frameDurationMs', label: 'frame duration', unit: 'ms' },
  { key: 'heapUsedBytes', label: 'heap used', unit: 'bytes' },
  { key: 'domNodes', label: 'DOM nodes', unit: '', minAbsDelta: 5 },
  { key: 'eventListeners', label: 'event listeners', unit: '', minAbsDelta: 5 }
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
  for (const entry of readdirSync(HISTORY_DIR)) {
    const entryPath = join(HISTORY_DIR, entry)
    const filePath = entry.endsWith('.json')
      ? entryPath
      : join(entryPath, 'perf-metrics.json')
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

function getHistoricalTimeSeries(
  reports: PerfReport[],
  testName: string,
  metric: MetricKey
): number[] {
  const sorted = [...reports].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  const values: number[] = []
  for (const r of sorted) {
    const group = groupByName(r.measurements)
    const samples = group.get(testName)
    if (samples) {
      values.push(
        samples.reduce((sum, s) => sum + s[metric], 0) / samples.length
      )
    }
  }
  return values
}

function computeCV(stats: MetricStats): number {
  return stats.mean > 0 ? (stats.stddev / stats.mean) * 100 : 0
}

function formatValue(value: number, unit: string): string {
  if (unit === 'ms') return `${value.toFixed(0)}ms`
  if (unit === 'bytes') return formatBytes(value)
  return `${value.toFixed(0)}`
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

function medianMetric(
  samples: PerfMeasurement[],
  key: MetricKey
): number | null {
  const values = samples
    .map((s) => getMetricValue(s, key))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)
  if (values.length === 0) return null
  const mid = Math.floor(values.length / 2)
  return values.length % 2 === 0
    ? (values[mid - 1] + values[mid]) / 2
    : values[mid]
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
    '| Metric | Baseline | PR (median) | Δ | Sig |',
    '|--------|----------|----------|---|-----|'
  ]

  const flaggedRows: string[] = []
  const allRows: string[] = []

  for (const [testName, prSamples] of prGroups) {
    const baseSamples = baselineGroups.get(testName)

    for (const { key, label, unit, minAbsDelta } of REPORTED_METRICS) {
      // Use median for PR values — robust to outlier runs in CI
      const prVal = medianMetric(prSamples, key)
      if (prVal === null) continue
      const histStats = getHistoricalStats(historical, testName, key)
      const cv = computeCV(histStats)

      if (!baseSamples?.length) {
        allRows.push(
          `| ${testName}: ${label} | — | ${formatValue(prVal, unit)} | new | — |`
        )
        continue
      }

      const baseVal = medianMetric(baseSamples, key)
      if (baseVal === null) {
        allRows.push(
          `| ${testName}: ${label} | — | ${formatValue(prVal, unit)} | new | — |`
        )
        continue
      }
      const absDelta = prVal - baseVal
      const deltaPct =
        baseVal === 0
          ? prVal === 0
            ? 0
            : null
          : ((prVal - baseVal) / baseVal) * 100
      const z = zScore(prVal, histStats)
      const sig = classifyChange(z, cv, absDelta, minAbsDelta)

      const row = `| ${testName}: ${label} | ${formatValue(baseVal, unit)} | ${formatValue(prVal, unit)} | ${formatDelta(deltaPct)} | ${formatSignificance(sig, z)} |`
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

  const trendRows: string[] = []
  for (const [testName] of prGroups) {
    for (const { key, label, unit } of REPORTED_METRICS) {
      const series = getHistoricalTimeSeries(historical, testName, key)
      if (series.length < 3) continue
      const dir = trendDirection(series)
      const arrow = trendArrow(dir)
      const spark = sparkline(series)
      const last = series[series.length - 1]
      trendRows.push(
        `| ${testName}: ${label} | ${spark} | ${arrow} | ${formatValue(last, unit)} |`
      )
    }
  }

  if (trendRows.length > 0) {
    lines.push(
      '',
      `<details><summary>Trend (last ${historical.length} commits on main)</summary>`,
      '',
      '| Metric | Trend | Dir | Latest |',
      '|--------|-------|-----|--------|',
      ...trendRows,
      '',
      '</details>'
    )
  }

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
    `> ℹ️ Collecting baseline variance data (${historicalCount}/15 runs). Significance will appear after 2 main branch runs.`,
    '',
    '| Metric | Baseline | PR | Δ |',
    '|--------|----------|-----|---|'
  )

  for (const [testName, prSamples] of prGroups) {
    const baseSamples = baselineGroups.get(testName)

    for (const { key, label, unit } of REPORTED_METRICS) {
      const prVal = medianMetric(prSamples, key)
      if (prVal === null) continue

      if (!baseSamples?.length) {
        lines.push(
          `| ${testName}: ${label} | — | ${formatValue(prVal, unit)} | new |`
        )
        continue
      }

      const baseVal = medianMetric(baseSamples, key)
      if (baseVal === null) {
        lines.push(
          `| ${testName}: ${label} | — | ${formatValue(prVal, unit)} | new |`
        )
        continue
      }
      const deltaPct =
        baseVal === 0
          ? prVal === 0
            ? 0
            : null
          : ((prVal - baseVal) / baseVal) * 100
      lines.push(
        `| ${testName}: ${label} | ${formatValue(baseVal, unit)} | ${formatValue(prVal, unit)} | ${formatDelta(deltaPct)} |`
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
      const prVal = medianMetric(prSamples, key)
      if (prVal === null) continue
      lines.push(`| ${testName}: ${label} | ${formatValue(prVal, unit)} |`)
    }
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
