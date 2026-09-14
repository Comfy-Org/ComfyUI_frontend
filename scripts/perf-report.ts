import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { filterComparableWorkloads } from '../browser_tests/fixtures/helpers/perfWorkloadIdentity'
import type {
  PerfMeasurement,
  PerfReport,
  PerfReportV3
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
  | 'taskOtherDurationMs'
  | 'v8CompileDurationMs'
  | 'devToolsCommandDurationMs'
  | 'threadTimeMs'
  | 'processTimeMs'
  | 'accountedTaskDurationMs'
  | 'taskAccountingResidualMs'
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

interface MetricAnalysis {
  testName: string
  metric: MetricDef
  currentValue: number
  baselineValue: number | null
  history: number[]
  stats: MetricStats
}

function escapeMarkdown(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('@', '&#64;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '&#124;')
    .replaceAll('`', '&#96;')
    .replaceAll('*', '&#42;')
    .replaceAll('[', '&#91;')
    .replaceAll(']', '&#93;')
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ')
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
  { key: 'taskOtherDurationMs', label: 'task other duration', unit: 'ms' },
  { key: 'v8CompileDurationMs', label: 'V8 compile duration', unit: 'ms' },
  {
    key: 'devToolsCommandDurationMs',
    label: 'DevTools command duration',
    unit: 'ms'
  },
  { key: 'threadTimeMs', label: 'thread time', unit: 'ms' },
  { key: 'processTimeMs', label: 'process time', unit: 'ms' },
  {
    key: 'accountedTaskDurationMs',
    label: 'accounted task duration',
    unit: 'ms'
  },
  {
    key: 'taskAccountingResidualMs',
    label: 'task accounting residual',
    unit: 'ms'
  },
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

function acceptedMeasurements(report: PerfReportV3): PerfMeasurement[] {
  return report.measurements.flatMap((result) =>
    result.kind === 'accepted' ? [result.measurement] : []
  )
}

function groupComparableCurrentMeasurements(report: PerfReportV3): {
  groups: Map<string, PerfMeasurement[]>
  mixedIdentityNames: string[]
} {
  const groups = groupByName(acceptedMeasurements(report))
  const mixedIdentityNames: string[] = []
  for (const [name, samples] of groups) {
    if (
      filterComparableWorkloads(samples[0], samples).length !== samples.length
    ) {
      groups.delete(name)
      mixedIdentityNames.push(name)
    }
  }
  return { groups, mixedIdentityNames }
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

function computeCV(stats: MetricStats): number {
  return stats.mean > 0 ? (stats.stddev / stats.mean) * 100 : 0
}

function formatValue(value: number, unit: string): string {
  if (unit === 'ms') return `${value.toFixed(0)}ms`
  if (unit === 'bytes') return formatBytes(value)
  return value.toFixed(0)
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

function analyzeMetrics(
  prGroups: Map<string, PerfMeasurement[]>,
  baseline: PerfReportV3 | null,
  historical: PerfReportV3[]
): MetricAnalysis[] {
  const baselineGroups = baseline
    ? groupByName(acceptedMeasurements(baseline))
    : new Map<string, PerfMeasurement[]>()
  const historicalGroups = [...historical]
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    .map((report) => groupByName(acceptedMeasurements(report)))
  const analyses: MetricAnalysis[] = []

  for (const [testName, prSamples] of prGroups) {
    const reference = prSamples[0]
    const baselineSamples = filterComparableWorkloads(
      reference,
      baselineGroups.get(testName) ?? []
    )
    const historicalSamples = historicalGroups.map((groups) =>
      filterComparableWorkloads(reference, groups.get(testName) ?? [])
    )

    for (const metric of REPORTED_METRICS) {
      const currentValue = medianMetric(prSamples, metric.key)
      if (currentValue === null) continue
      const history = historicalSamples.flatMap((samples) => {
        const value = meanMetric(samples, metric.key)
        return value === null ? [] : [value]
      })
      analyses.push({
        testName,
        metric,
        currentValue,
        baselineValue: medianMetric(baselineSamples, metric.key),
        history,
        stats: computeStats(history)
      })
    }
  }
  return analyses
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

    const parts: string[] = [`**${escapeMarkdown(testName)}**:`]
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
  analyses: MetricAnalysis[],
  historicalCount: number
): string[] {
  const lines: string[] = []
  const tableHeader = [
    '| Metric | Baseline | PR (median) | Δ | Sig |',
    '|--------|----------|----------|---|-----|'
  ]

  const flaggedRows: string[] = []
  const allRows: string[] = []
  let hasComparableBaseline = false
  let hasInsufficientHistory = false

  for (const {
    testName,
    metric,
    currentValue,
    baselineValue,
    stats
  } of analyses) {
    const displayName = escapeMarkdown(testName)
    const { label, unit, minAbsDelta } = metric

    if (baselineValue === null) {
      allRows.push(
        `| ${displayName}: ${label} | — | ${formatValue(currentValue, unit)} | new | — |`
      )
      continue
    }

    const absDelta = currentValue - baselineValue
    const deltaPct =
      baselineValue === 0
        ? currentValue === 0
          ? 0
          : null
        : ((currentValue - baselineValue) / baselineValue) * 100
    const cv = computeCV(stats)
    const z = zScore(currentValue, stats)
    const significance = classifyChange(z, cv, absDelta, minAbsDelta)
    hasComparableBaseline = true
    hasInsufficientHistory ||= stats.n < 2

    const row = `| ${displayName}: ${label} | ${formatValue(baselineValue, unit)} | ${formatValue(currentValue, unit)} | ${formatDelta(deltaPct)} | ${formatSignificance(significance, z)} |`
    allRows.push(row)
    if (isNoteworthy(significance)) {
      flaggedRows.push(row)
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
  } else if (hasComparableBaseline && !hasInsufficientHistory) {
    lines.push('✅ No regressions detected.', '')
  } else {
    lines.push(
      '> ℹ️ Not enough compatible history to calculate significance.',
      ''
    )
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
    `<details><summary>Historical variance (last ${historicalCount} runs)</summary>`,
    '',
    '| Metric | μ | σ | CV |',
    '|--------|---|---|-----|'
  )
  for (const { testName, metric, stats } of analyses) {
    const displayName = escapeMarkdown(testName)
    if (stats.n < 2) continue
    const cv = computeCV(stats)
    lines.push(
      `| ${displayName}: ${metric.label} | ${formatValue(stats.mean, metric.unit)} | ${formatValue(stats.stddev, metric.unit)} | ${cv.toFixed(1)}% |`
    )
  }
  lines.push('', '</details>')

  const trendRows: string[] = []
  for (const { testName, metric, history } of analyses) {
    const displayName = escapeMarkdown(testName)
    if (history.length < 3) continue
    const direction = trendDirection(history)
    const last = history[history.length - 1]
    trendRows.push(
      `| ${displayName}: ${metric.label} | ${sparkline(history)} | ${trendArrow(direction)} | ${formatValue(last, metric.unit)} |`
    )
  }

  if (trendRows.length > 0) {
    lines.push(
      '',
      `<details><summary>Trend (last ${historicalCount} commits on main)</summary>`,
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
  analyses: MetricAnalysis[],
  historicalCount: number
): string[] {
  const lines: string[] = []
  lines.push(
    `> ℹ️ Collecting baseline variance data (${historicalCount}/15 runs). Significance will appear after 2 main branch runs.`,
    '',
    '<details><summary>All metrics (cold start)</summary>',
    '',
    '| Metric | Baseline | PR | Δ |',
    '|--------|----------|-----|---|'
  )

  for (const { testName, metric, currentValue, baselineValue } of analyses) {
    const displayName = escapeMarkdown(testName)
    const { label, unit } = metric

    if (baselineValue === null) {
      lines.push(
        `| ${displayName}: ${label} | — | ${formatValue(currentValue, unit)} | new |`
      )
      continue
    }
    const deltaPct =
      baselineValue === 0
        ? currentValue === 0
          ? 0
          : null
        : ((currentValue - baselineValue) / baselineValue) * 100
    lines.push(
      `| ${displayName}: ${label} | ${formatValue(baselineValue, unit)} | ${formatValue(currentValue, unit)} | ${formatDelta(deltaPct)} |`
    )
  }

  lines.push('', '</details>')
  return lines
}

function renderNoBaselineReport(analyses: MetricAnalysis[]): string[] {
  const lines: string[] = []
  lines.push(
    '> ℹ️ No baseline found — significance unavailable.',
    '',
    '<details><summary>Absolute values</summary>',
    '',
    '| Metric | Value |',
    '|--------|-------|'
  )
  for (const { testName, metric, currentValue } of analyses) {
    lines.push(
      `| ${escapeMarkdown(testName)}: ${metric.label} | ${formatValue(currentValue, metric.unit)} |`
    )
  }
  lines.push('', '</details>')
  return lines
}

function renderRejectedMeasurements(report: PerfReportV3): string[] {
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
      (result) =>
        `| ${escapeMarkdown(result.measurement.name)} | ${escapeMarkdown(result.reason)} |`
    ),
    '',
    '</details>',
    ''
  ]
}

export function renderPerfReport(
  current: PerfReportV3,
  baseline: PerfReport | null,
  historical: PerfReport[]
): string {
  const compatibleHistory = historical.filter(
    (report): report is PerfReportV3 => report.schemaVersion === 3
  )
  const { groups: prGroups, mixedIdentityNames } =
    groupComparableCurrentMeasurements(current)

  const lines: string[] = ['## ⚡ Performance Report\n']
  lines.push(...renderRejectedMeasurements(current))
  lines.push(
    ...mixedIdentityNames.flatMap((name) => [
      `> ⚠️ ${escapeMarkdown(name)} rejected because its current samples have mixed workload identities.`,
      ''
    ])
  )
  lines.push(...renderHeadlineSummary(prGroups))

  const compatibleBaseline =
    baseline?.schemaVersion === current.schemaVersion ? baseline : null
  const analyses = analyzeMetrics(
    prGroups,
    compatibleBaseline,
    compatibleHistory
  )

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
    lines.push(...renderNoBaselineReport(analyses))
  } else if (compatibleBaseline && compatibleHistory.length >= 2) {
    lines.push(...renderFullReport(analyses, compatibleHistory.length))
  } else if (compatibleBaseline) {
    lines.push(...renderColdStartReport(analyses, compatibleHistory.length))
  } else {
    lines.push(...renderNoBaselineReport(analyses))
  }
  return lines.join('\n') + '\n'
}

function main() {
  if (!existsSync(CURRENT_PATH)) {
    process.stdout.write(
      '## ⚡ Performance Report\n\nNo perf metrics found. Perf tests may not have run.\n'
    )
    process.exit(0)
  }

  const current = readPerfReport(CURRENT_PATH)
  if (current.schemaVersion !== 3) {
    throw new Error('Current performance report must use schema v3')
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
