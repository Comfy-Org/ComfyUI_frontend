import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { renderPrReportSection } from './cicd/pr-report-section'
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
  p95FrameDurationMs: number
  allFrameDurationsMs?: number[]
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
  | 'p95FrameDurationMs'
  | 'heapUsedBytes'
  | 'heapDeltaBytes'

interface MetricDef {
  key: MetricKey
  label: string
  unit: string
  /** Minimum absolute delta to consider meaningful (effect size gate) */
  minAbsDelta?: number
}

const REPORTED_METRICS: MetricDef[] = [
  { key: 'frameDurationMs', label: 'avg frame time', unit: 'ms' },
  { key: 'p95FrameDurationMs', label: 'p95 frame time', unit: 'ms' },
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
  { key: 'heapDeltaBytes', label: 'heap delta', unit: 'bytes' },
  { key: 'domNodes', label: 'DOM nodes', unit: '', minAbsDelta: 5 },
  { key: 'eventListeners', label: 'event listeners', unit: '', minAbsDelta: 5 }
]

/** Target: P5 FPS ≥ 52 */
const TARGET_P5_FPS = 52

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
      const mean = reportedMean(samples, metric)
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
      const mean = reportedMean(samples, metric)
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

function frameTimeToFps(ms: number): number {
  return ms > 0 ? 1000 / ms : 0
}

type FrameMetricKey = 'frameDurationMs' | 'p95FrameDurationMs'

function isFrameMetric(key: MetricKey): key is FrameMetricKey {
  return key === 'frameDurationMs' || key === 'p95FrameDurationMs'
}

function frameSampled(
  samples: PerfMeasurement[],
  key: FrameMetricKey
): PerfMeasurement[] {
  return samples.filter((s) => (getMetricValue(s, key) ?? 0) > 0)
}

function sampledFrameMetric(
  samples: PerfMeasurement[],
  key: FrameMetricKey
): number | null {
  return medianMetric(frameSampled(samples, key), key)
}

function reportedMedian(
  samples: PerfMeasurement[],
  key: MetricKey
): number | null {
  return isFrameMetric(key)
    ? sampledFrameMetric(samples, key)
    : medianMetric(samples, key)
}

function reportedMean(
  samples: PerfMeasurement[],
  key: MetricKey
): number | null {
  return meanMetric(
    isFrameMetric(key) ? frameSampled(samples, key) : samples,
    key
  )
}

interface FpsTargetTally {
  below: number
  sampled: number
  unsampled: number
}

function tallyFpsTarget(
  prGroups: Map<string, PerfMeasurement[]>
): FpsTargetTally {
  const tally: FpsTargetTally = { below: 0, sampled: 0, unsampled: 0 }
  for (const prSamples of prGroups.values()) {
    const p95Frame = sampledFrameMetric(prSamples, 'p95FrameDurationMs')
    if (p95Frame === null) {
      if (medianMetric(prSamples, 'p95FrameDurationMs') !== null)
        tally.unsampled++
      continue
    }
    tally.sampled++
    if (frameTimeToFps(p95Frame) < TARGET_P5_FPS) tally.below++
  }
  return tally
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function percentDelta(prVal: number, baseVal: number): number | null {
  if (baseVal === 0) return prVal === 0 ? 0 : null
  return ((prVal - baseVal) / baseVal) * 100
}

function baselineMedian(
  baseSamples: PerfMeasurement[] | undefined,
  key: MetricKey
): number | null {
  return baseSamples?.length ? reportedMedian(baseSamples, key) : null
}

function formatIfPresent(
  value: number | null,
  format: (value: number) => string
): string | null {
  return value === null ? null : format(value)
}

function p5FpsPart(p95Frame: number): string {
  const p5Fps = frameTimeToFps(p95Frame)
  const verdict = p5Fps >= TARGET_P5_FPS ? '✅' : '❌'
  return `${p5Fps.toFixed(1)} P5 FPS ${verdict} (target: ≥${TARGET_P5_FPS})`
}

function scenarioSummary(
  testName: string,
  prSamples: PerfMeasurement[]
): string | null {
  const parts = [
    formatIfPresent(
      sampledFrameMetric(prSamples, 'frameDurationMs'),
      (ms) => `${frameTimeToFps(ms).toFixed(1)} avg FPS`
    ),
    formatIfPresent(
      sampledFrameMetric(prSamples, 'p95FrameDurationMs'),
      p5FpsPart
    ),
    formatIfPresent(
      medianMetric(prSamples, 'totalBlockingTimeMs'),
      (ms) => `${ms.toFixed(0)}ms TBT`
    ),
    formatIfPresent(
      medianMetric(prSamples, 'heapUsedBytes'),
      (bytes) => `${formatBytes(bytes)} heap`
    )
  ].filter((part): part is string => part !== null)

  return parts.length > 0 ? `**${testName}**: ${parts.join(' · ')}` : null
}

function fpsTargetNotice({ below, unsampled }: FpsTargetTally): string[] {
  const notice: string[] = []
  if (below > 0) {
    notice.push(
      `> ❌ **${plural(below, 'scenario')} below the ≥${TARGET_P5_FPS} P5 FPS target.** Expand the scenario timings below and profile the affected scenarios before merging.`,
      ''
    )
  }
  if (unsampled > 0) {
    notice.push(
      `> ⚠️ ${plural(unsampled, 'scenario')} recorded no frame samples, so ${unsampled === 1 ? 'its' : 'their'} FPS could not be checked against the target. Check the perf test logs for a frame sampling timeout.`,
      ''
    )
  }
  return notice
}

function renderHeadlineSummary(prGroups: Map<string, PerfMeasurement[]>): {
  notice: string[]
  lines: string[]
} {
  const notice = fpsTargetNotice(tallyFpsTarget(prGroups))
  const lines: string[] = []
  const summaries = [...prGroups]
    .map(([testName, prSamples]) => scenarioSummary(testName, prSamples))
    .filter((summary): summary is string => summary !== null)

  if (summaries.length > 0) {
    lines.push(
      '<details><summary>Scenario timings</summary>',
      '',
      '> ' + summaries.join('\n> '),
      '',
      '</details>',
      ''
    )
  }

  return { notice, lines }
}

interface RenderedReport {
  status: string
  notice?: string[]
  lines: string[]
}

interface ComparedRow {
  row: string
  flagged: boolean
}

function compareMetric(
  testName: string,
  metric: MetricDef,
  prSamples: PerfMeasurement[],
  baseSamples: PerfMeasurement[] | undefined,
  historical: PerfReport[]
): ComparedRow | null {
  const { key, label, unit, minAbsDelta } = metric
  const prVal = reportedMedian(prSamples, key)
  if (prVal === null) return null

  const baseVal = baselineMedian(baseSamples, key)
  if (baseVal === null) {
    return {
      row: `| ${testName}: ${label} | — | ${formatValue(prVal, unit)} | new | — |`,
      flagged: false
    }
  }

  const histStats = getHistoricalStats(historical, testName, key)
  const z = zScore(prVal, histStats)
  const sig = classifyChange(
    z,
    computeCV(histStats),
    prVal - baseVal,
    minAbsDelta
  )

  return {
    row: `| ${testName}: ${label} | ${formatValue(baseVal, unit)} | ${formatValue(prVal, unit)} | ${formatDelta(percentDelta(prVal, baseVal))} | ${formatSignificance(sig, z)} |`,
    flagged: isNoteworthy(sig)
  }
}

function regressionVerdict(count: number): string {
  return `${count} regression${count > 1 ? 's' : ''} detected`
}

function renderFullReport(
  prGroups: Map<string, PerfMeasurement[]>,
  baseline: PerfReport,
  historical: PerfReport[]
): RenderedReport {
  const lines: string[] = []
  const baselineGroups = groupByName(baseline.measurements)
  const tableHeader = [
    '| Metric | Baseline | PR (median) | Δ | Sig |',
    '|--------|----------|----------|---|-----|'
  ]

  const compared = [...prGroups].flatMap(([testName, prSamples]) =>
    REPORTED_METRICS.map((metric) =>
      compareMetric(
        testName,
        metric,
        prSamples,
        baselineGroups.get(testName),
        historical
      )
    ).filter((row): row is ComparedRow => row !== null)
  )
  const allRows = compared.map(({ row }) => row)
  const flaggedRows = compared
    .filter(({ flagged }) => flagged)
    .map(({ row }) => row)

  const status =
    flaggedRows.length > 0
      ? `⚠️ ${regressionVerdict(flaggedRows.length)}`
      : '✅ No regressions detected'

  const notice: string[] = []
  if (flaggedRows.length > 0) {
    notice.push(
      `⚠️ **${regressionVerdict(flaggedRows.length)}**. Review the regressions below and profile the affected scenarios before merging.`,
      ''
    )
    lines.push(
      '<details><summary>Show regressions</summary>',
      '',
      ...tableHeader,
      ...flaggedRows,
      '',
      '</details>',
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
    ...renderHistoricalVariance(prGroups, historical),
    ...renderTrend(prGroups, historical)
  )

  return { status, notice, lines }
}

function renderHistoricalVariance(
  prGroups: Map<string, PerfMeasurement[]>,
  historical: PerfReport[]
): string[] {
  const lines = [
    `<details><summary>Historical variance (up to ${historical.length} runs per metric)</summary>`,
    '',
    '| Metric | μ | σ | CV |',
    '|--------|---|---|-----|'
  ]
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

function renderTrend(
  prGroups: Map<string, PerfMeasurement[]>,
  historical: PerfReport[]
): string[] {
  const trendRows: string[] = []
  for (const [testName] of prGroups) {
    for (const { key, label, unit } of REPORTED_METRICS) {
      const series = getHistoricalTimeSeries(historical, testName, key)
      if (series.length < 3) continue
      const arrow = trendArrow(trendDirection(series))
      const last = series[series.length - 1]
      trendRows.push(
        `| ${testName}: ${label} | ${sparkline(series)} | ${arrow} | ${formatValue(last, unit)} |`
      )
    }
  }
  if (trendRows.length === 0) return []
  return [
    '',
    `<details><summary>Trend (up to ${historical.length} commits on main per metric)</summary>`,
    '',
    '| Metric | Trend | Dir | Latest |',
    '|--------|-------|-----|--------|',
    ...trendRows,
    '',
    '</details>'
  ]
}

function renderColdStartReport(
  prGroups: Map<string, PerfMeasurement[]>,
  baseline: PerfReport,
  historicalCount: number
): RenderedReport {
  const lines: string[] = []
  const baselineGroups = groupByName(baseline.measurements)
  lines.push(
    '> Significance will appear after 2 main branch runs.',
    '',
    '<details><summary>All metrics (cold start)</summary>',
    '',
    '| Metric | Baseline | PR | Δ |',
    '|--------|----------|-----|---|'
  )

  for (const [testName, prSamples] of prGroups) {
    const baseSamples = baselineGroups.get(testName)

    for (const { key, label, unit } of REPORTED_METRICS) {
      const prVal = reportedMedian(prSamples, key)
      if (prVal === null) continue

      const baseVal = baselineMedian(baseSamples, key)
      lines.push(
        baseVal === null
          ? `| ${testName}: ${label} | — | ${formatValue(prVal, unit)} | new |`
          : `| ${testName}: ${label} | ${formatValue(baseVal, unit)} | ${formatValue(prVal, unit)} | ${formatDelta(percentDelta(prVal, baseVal))} |`
      )
    }
  }

  lines.push('', '</details>')
  return {
    status: `ℹ️ Collecting baseline variance (${historicalCount}/15 runs)`,
    lines
  }
}

function renderNoBaselineReport(
  prGroups: Map<string, PerfMeasurement[]>
): RenderedReport {
  const lines: string[] = []
  lines.push(
    '<details><summary>Absolute values</summary>',
    '',
    '| Metric | Value |',
    '|--------|-------|'
  )
  for (const [testName, prSamples] of prGroups) {
    for (const { key, label, unit } of REPORTED_METRICS) {
      const prVal = reportedMedian(prSamples, key)
      if (prVal === null) continue
      lines.push(`| ${testName}: ${label} | ${formatValue(prVal, unit)} |`)
    }
  }
  lines.push('', '</details>')
  return { status: 'ℹ️ No baseline — significance unavailable', lines }
}

function renderComparison(
  prGroups: Map<string, PerfMeasurement[]>
): RenderedReport {
  if (!existsSync(BASELINE_PATH)) return renderNoBaselineReport(prGroups)
  const baseline: PerfReport = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
  const historical = loadHistoricalReports()
  return historical.length >= 2
    ? renderFullReport(prGroups, baseline, historical)
    : renderColdStartReport(prGroups, baseline, historical.length)
}

function renderRawData(current: PerfReport): string[] {
  const rawData = {
    ...current,
    measurements: current.measurements.map(
      ({ allFrameDurationsMs: _, ...rest }) => rest
    )
  }
  return [
    '',
    '<details><summary>Raw data</summary>',
    '',
    '```json',
    JSON.stringify(rawData, null, 2),
    '```',
    '',
    '</details>'
  ]
}

function perfHeadingStatus(
  current: PerfReport,
  prGroups: Map<string, PerfMeasurement[]>,
  reportStatus: string
): string {
  if (current.measurements.length === 0)
    return '⚠️ No measurements recorded — check the perf test logs'
  const fps = tallyFpsTarget(prGroups)
  if (fps.below > 0)
    return `❌ ${fps.below} below ${TARGET_P5_FPS} FPS target · ${reportStatus}`
  if (fps.unsampled > 0 && fps.sampled === 0)
    return `⚠️ No frame samples — FPS target not checked · ${reportStatus}`
  return reportStatus
}

function main() {
  if (!existsSync(CURRENT_PATH)) {
    process.stdout.write(
      renderPrReportSection({
        icon: '⚡',
        title: 'Performance',
        status: '⏭️ No metrics found — perf tests may not have run'
      }) + '\n'
    )
    process.exit(0)
  }

  const current: PerfReport = JSON.parse(readFileSync(CURRENT_PATH, 'utf-8'))
  const prGroups = groupByName(current.measurements)
  const report = renderComparison(prGroups)

  const headline = renderHeadlineSummary(prGroups)
  const body = [...headline.lines, ...report.lines, ...renderRawData(current)]
  const status = perfHeadingStatus(current, prGroups, report.status)

  process.stdout.write(
    renderPrReportSection({
      icon: '⚡',
      title: 'Performance',
      status,
      notice: [...headline.notice, ...(report.notice ?? [])].join('\n'),
      body: body.join('\n')
    }) + '\n'
  )
}

main()
