import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import type {
  PerfMeasurement,
  PerfReport,
  PerfReportV2
} from '../browser_tests/fixtures/utils/perfReportSchema'
import { perfReportSchema } from '../browser_tests/fixtures/utils/perfReportSchema'
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
  | 'rafIntervalP50Ms'
  | 'rafIntervalP95Ms'
  | 'rafIntervalP99Ms'
  | 'rafIntervalMaxMs'
  | 'rafIntervalsOver8_33Ms'
  | 'rafIntervalsOver16_67Ms'
  | 'rafIntervalsOver33_3Ms'
  | 'rafIntervalsOver50Ms'
  | 'heapUsedBytes'

interface MetricDef {
  key: MetricKey
  label: string
  unit: string
  /** Minimum absolute delta to consider meaningful (effect size gate) */
  minAbsDelta?: number
}

const REPORTED_METRICS: MetricDef[] = [
  { key: 'rafIntervalP50Ms', label: 'rAF interval p50', unit: 'ms' },
  { key: 'rafIntervalP95Ms', label: 'rAF interval p95', unit: 'ms' },
  { key: 'rafIntervalP99Ms', label: 'rAF interval p99', unit: 'ms' },
  { key: 'rafIntervalMaxMs', label: 'rAF interval max', unit: 'ms' },
  {
    key: 'rafIntervalsOver8_33Ms',
    label: 'rAF intervals >8.33ms',
    unit: ''
  },
  {
    key: 'rafIntervalsOver16_67Ms',
    label: 'rAF intervals >16.67ms',
    unit: ''
  },
  {
    key: 'rafIntervalsOver33_3Ms',
    label: 'rAF intervals >33.3ms',
    unit: ''
  },
  { key: 'rafIntervalsOver50Ms', label: 'rAF intervals >50ms', unit: '' },
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

function acceptedMeasurements(report: PerfReportV2): PerfMeasurement[] {
  return report.measurements.flatMap((result) =>
    result.kind === 'accepted' ? [result.measurement] : []
  )
}

function readPerfReport(path: string): PerfReport {
  const value: unknown = JSON.parse(readFileSync(path, 'utf-8'))
  return perfReportSchema.parse(value)
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
      reports.push(readPerfReport(filePath))
    } catch {
      console.warn(`Skipping malformed perf history: ${filePath}`)
    }
  }
  return reports
}

function getHistoricalStats(
  reports: PerfReportV2[],
  testName: string,
  metric: MetricKey
): MetricStats {
  const values: number[] = []
  for (const r of reports) {
    const group = groupByName(acceptedMeasurements(r))
    const samples = group.get(testName)
    if (samples) {
      const mean = meanMetric(samples, metric)
      if (mean !== null) values.push(mean)
    }
  }
  return computeStats(values)
}

function getHistoricalTimeSeries(
  reports: PerfReportV2[],
  testName: string,
  metric: MetricKey
): number[] {
  const sorted = [...reports].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  const values: number[] = []
  for (const r of sorted) {
    const group = groupByName(acceptedMeasurements(r))
    const samples = group.get(testName)
    if (samples) {
      const mean = meanMetric(samples, metric)
      if (mean !== null) values.push(mean)
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
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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

function renderHeadlineSummary(
  prGroups: Map<string, PerfMeasurement[]>
): string[] {
  const lines: string[] = []
  const summaries: string[] = []

  for (const [testName, prSamples] of prGroups) {
    const p95Interval = medianMetric(prSamples, 'rafIntervalP95Ms')
    const maxInterval = medianMetric(prSamples, 'rafIntervalMaxMs')
    const over16 = medianMetric(prSamples, 'rafIntervalsOver16_67Ms')
    const tbt = medianMetric(prSamples, 'totalBlockingTimeMs')
    const heap = medianMetric(prSamples, 'heapUsedBytes')

    const parts: string[] = [`**${testName}**:`]
    if (p95Interval !== null) parts.push(`${p95Interval.toFixed(1)}ms rAF p95`)
    if (maxInterval !== null) parts.push(`${maxInterval.toFixed(1)}ms rAF max`)
    if (over16 !== null) parts.push(`${over16.toFixed(0)} intervals >16.67ms`)
    if (tbt !== null) parts.push(`${tbt.toFixed(0)}ms TBT`)
    if (heap !== null) parts.push(`${formatBytes(heap)} heap`)

    if (parts.length > 1) {
      summaries.push(`${parts[0]} ${parts.slice(1).join(' · ')}`)
    }
  }

  if (summaries.length > 0) {
    lines.push('> ' + summaries.join('\n> '), '')
  }

  return lines
}

function renderFullReport(
  prGroups: Map<string, PerfMeasurement[]>,
  baseline: PerfReportV2,
  historical: PerfReportV2[]
): string[] {
  const lines: string[] = []
  const baselineGroups = groupByName(acceptedMeasurements(baseline))
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
      '<details><summary>Show regressions</summary>',
      '',
      ...tableHeader,
      ...flaggedRows,
      '',
      '</details>',
      ''
    )
  } else {
    lines.push('✅ No regressions detected.', '')
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
  baseline: PerfReportV2,
  historicalCount: number
): string[] {
  const lines: string[] = []
  const baselineGroups = groupByName(acceptedMeasurements(baseline))
  lines.push(
    `> ℹ️ Collecting baseline variance data (${historicalCount}/15 runs). Significance will appear after 2 main branch runs.`,
    '',
    '<details><summary>All metrics (cold start)</summary>',
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

  lines.push('', '</details>')
  return lines
}

function renderNoBaselineReport(
  prGroups: Map<string, PerfMeasurement[]>
): string[] {
  const lines: string[] = []
  lines.push(
    '> ℹ️ No baseline found — significance unavailable.',
    '',
    '<details><summary>Absolute values</summary>',
    '',
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
  lines.push('', '</details>')
  return lines
}

function renderRejectedMeasurements(report: PerfReportV2): string[] {
  const rejected = report.measurements.filter(
    (result) => result.kind === 'rejected'
  )
  if (rejected.length === 0) return []

  return [
    `> ⚠️ ${rejected.length} measurement${rejected.length === 1 ? '' : 's'} rejected and excluded from all statistics.`,
    '',
    '<details><summary>Rejected measurements</summary>',
    '',
    '| Test | Reason |',
    '|------|--------|',
    ...rejected.map(
      (result) => `| ${result.measurement.name} | ${result.reason} |`
    ),
    '',
    '</details>',
    ''
  ]
}

export function renderPerfReport(
  current: PerfReportV2,
  baseline: PerfReport | null,
  historical: PerfReport[]
): string {
  const compatibleHistory = historical.filter(
    (report): report is PerfReportV2 => report.schemaVersion === 2
  )
  const prGroups = groupByName(acceptedMeasurements(current))

  const lines: string[] = ['## ⚡ Performance Report\n']
  lines.push(...renderRejectedMeasurements(current))
  lines.push(...renderHeadlineSummary(prGroups))

  const compatibleBaseline =
    baseline?.schemaVersion === current.schemaVersion ? baseline : null

  if (prGroups.size === 0) {
    lines.push(
      '> ⚠️ No accepted measurements were available. No regression verdict was calculated.',
      ''
    )
  } else if (baseline && !compatibleBaseline) {
    lines.push(
      `> ℹ️ Baseline schema v${baseline.schemaVersion ?? 1} is not comparable with current schema v${current.schemaVersion}. Starting a new measurement epoch.`,
      ''
    )
    lines.push(...renderNoBaselineReport(prGroups))
  } else if (compatibleBaseline && compatibleHistory.length >= 2) {
    lines.push(
      ...renderFullReport(prGroups, compatibleBaseline, compatibleHistory)
    )
  } else if (compatibleBaseline) {
    lines.push(
      ...renderColdStartReport(
        prGroups,
        compatibleBaseline,
        compatibleHistory.length
      )
    )
  } else {
    lines.push(...renderNoBaselineReport(prGroups))
  }

  const commentData = {
    ...current,
    measurements: current.measurements.map((result) => {
      const { rafIntervalsMs: _, ...measurement } = result.measurement
      return { ...result, measurement }
    })
  }
  lines.push('\n<details><summary>Summary data</summary>\n')
  lines.push('```json')
  lines.push(JSON.stringify(commentData, null, 2))
  lines.push('```')
  lines.push('\n</details>')

  return lines.join('\n') + '\n'
}

function main() {
  if (!existsSync(CURRENT_PATH)) {
    process.stdout.write(
      '## ⚡ Performance Report\n\nNo perf metrics found. Perf tests may not have run.\n'
    )
    return
  }

  const current = readPerfReport(CURRENT_PATH)
  if (current.schemaVersion !== 2) {
    throw new Error('Current performance report must use schema v2')
  }

  const baseline: PerfReport | null = existsSync(BASELINE_PATH)
    ? readPerfReport(BASELINE_PATH)
    : null

  const historical = loadHistoricalReports()
  process.stdout.write(renderPerfReport(current, baseline, historical))
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
}
