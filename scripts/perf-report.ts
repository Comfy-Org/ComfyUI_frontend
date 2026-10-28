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

/**
 * PerformanceHelper records a frame duration of 0 when sampling times out or
 * collects fewer than two timestamps. That is missing data, not a scenario
 * running at 0 FPS, so it must never count as a target miss.
 */
function sampledFrameMetric(
  samples: PerfMeasurement[],
  key: 'frameDurationMs' | 'p95FrameDurationMs'
): number | null {
  // Drop the unsampled runs before the median: left in, a 0 drags the median
  // frame time down and reports a scenario faster than it ran.
  const sampled = samples.filter((s) => (getMetricValue(s, key) ?? 0) > 0)
  return medianMetric(sampled, key)
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

function renderHeadlineSummary(prGroups: Map<string, PerfMeasurement[]>): {
  notice: string[]
  lines: string[]
} {
  const notice: string[] = []
  const lines: string[] = []
  const summaries: string[] = []
  const { below: belowTarget, unsampled } = tallyFpsTarget(prGroups)

  for (const [testName, prSamples] of prGroups) {
    const avgFrame = sampledFrameMetric(prSamples, 'frameDurationMs')
    const p95Frame = sampledFrameMetric(prSamples, 'p95FrameDurationMs')
    const tbt = medianMetric(prSamples, 'totalBlockingTimeMs')
    const heap = medianMetric(prSamples, 'heapUsedBytes')

    const avgFps = avgFrame !== null ? frameTimeToFps(avgFrame) : null
    const p5Fps = p95Frame !== null ? frameTimeToFps(p95Frame) : null

    const parts: string[] = [`**${testName}**:`]
    if (avgFps !== null) parts.push(`${avgFps.toFixed(1)} avg FPS`)
    if (p5Fps !== null) {
      const pass = p5Fps >= TARGET_P5_FPS
      parts.push(
        `${p5Fps.toFixed(1)} P5 FPS ${pass ? '✅' : '❌'} (target: ≥${TARGET_P5_FPS})`
      )
    }
    if (tbt !== null) parts.push(`${tbt.toFixed(0)}ms TBT`)
    if (heap !== null) parts.push(`${formatBytes(heap)} heap`)

    if (parts.length > 1) summaries.push(parts.join(' · '))
  }

  if (belowTarget > 0) {
    notice.push(
      `> ❌ **${plural(belowTarget, 'scenario')} below the ≥${TARGET_P5_FPS} P5 FPS target.** Expand the scenario timings below and profile the affected scenarios before merging.`,
      ''
    )
  }

  if (unsampled > 0) {
    notice.push(
      `> ⚠️ ${plural(unsampled, 'scenario')} recorded no frame samples, so ${unsampled === 1 ? 'its' : 'their'} FPS could not be checked against the target. Check the perf test logs for a frame sampling timeout.`,
      ''
    )
  }

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

  const flaggedRows: string[] = []
  const allRows: string[] = []

  for (const [testName, prSamples] of prGroups) {
    const baseSamples = baselineGroups.get(testName)

    for (const { key, label, unit, minAbsDelta } of REPORTED_METRICS) {
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

  const status =
    flaggedRows.length > 0
      ? `⚠️ ${flaggedRows.length} regression${flaggedRows.length > 1 ? 's' : ''} detected`
      : '✅ No regressions detected'

  const notice: string[] = []
  if (flaggedRows.length > 0) {
    notice.push(
      `⚠️ **${flaggedRows.length} regression${flaggedRows.length > 1 ? 's' : ''} detected**. Review the regressions below and profile the affected scenarios before merging.`,
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

  return { status, notice, lines }
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
      const prVal = medianMetric(prSamples, key)
      if (prVal === null) continue
      lines.push(`| ${testName}: ${label} | ${formatValue(prVal, unit)} |`)
    }
  }
  lines.push('', '</details>')
  return { status: 'ℹ️ No baseline — significance unavailable', lines }
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

  const baseline: PerfReport | null = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
    : null

  const historical = loadHistoricalReports()
  const prGroups = groupByName(current.measurements)

  const report =
    baseline && historical.length >= 2
      ? renderFullReport(prGroups, baseline, historical)
      : baseline
        ? renderColdStartReport(prGroups, baseline, historical.length)
        : renderNoBaselineReport(prGroups)

  const rawData = {
    ...current,
    measurements: current.measurements.map(
      ({ allFrameDurationsMs: _, ...rest }) => rest
    )
  }

  const headline = renderHeadlineSummary(prGroups)
  const body = [
    ...headline.lines,
    ...report.lines,
    '',
    '<details><summary>Raw data</summary>',
    '',
    '```json',
    JSON.stringify(rawData, null, 2),
    '```',
    '',
    '</details>'
  ]

  // The per-test target verdict lives in the collapsed summary, so without
  // this the heading can read ✅ over a hidden ❌. It leads, because a reader
  // scanning the comment takes the verdict from the first glyph and a target
  // miss outranks "nothing moved since the baseline". A run that measured
  // nothing has no verdict at all, and must not read as a clean one.
  // Frame data that never arrived is not a pass either: with nothing sampled
  // the target was not checked at all.
  const fps = tallyFpsTarget(prGroups)
  const status =
    current.measurements.length === 0
      ? '⚠️ No measurements recorded — check the perf test logs'
      : fps.below > 0
        ? `❌ ${fps.below} below ${TARGET_P5_FPS} FPS target · ${report.status}`
        : fps.unsampled > 0 && fps.sampled === 0
          ? `⚠️ No frame samples — FPS target not checked · ${report.status}`
          : report.status

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
