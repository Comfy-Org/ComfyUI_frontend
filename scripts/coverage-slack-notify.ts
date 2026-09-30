import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  COVERAGE_METADATA_FILE,
  readCoverageMetadata
} from './coverage-metadata'

const TARGET = 80
const MILESTONE_STEP = 5
const MIN_DELTA = 0.05
const BAR_WIDTH = 20
const UNIT_COVERAGE_DIR = 'coverage'
const UNIT_BASELINE_DIR = 'temp/coverage-baseline'
const E2E_COVERAGE_DIR = 'temp/e2e-coverage'
const E2E_BASELINE_DIR = 'temp/e2e-coverage-baseline'

/** Repo-relative prefixes of the files whose coverage this report is about. */
const PROJECT_SOURCE = /^(src|packages)\//
/** Below this the tracefile is degenerate, not sparse, and its ratio is noise. */
const MIN_SOURCE_FILES = 100

interface CoverageData {
  percentage: number
  totalLines: number
  coveredLines: number
}

interface CoverageSnapshot {
  current: CoverageData | null
  baseline: CoverageData | null
  currentSha?: string
  baselineSha?: string
}

interface ReportContext {
  prUrl: string
  prNumber: string
  author: string
}

interface SlackBlock {
  type: 'section'
  text: {
    type: 'mrkdwn'
    text: string
  }
}

interface SlackPayload {
  text: string
  blocks: SlackBlock[]
}

type Direction = 'up' | 'down' | 'mixed'

const HEADLINE: Record<Direction, { icon: string; text: string }> = {
  up: { icon: '✅', text: 'Coverage improved!' },
  down: { icon: '🔻', text: 'Coverage decreased' },
  mixed: { icon: '↔️', text: 'Coverage changed' }
}

export function parseLcovContent(content: string): CoverageData | null {
  const perFile = new Map<string, { lf: number; lh: number }>()
  let currentFile = ''

  for (const line of content.split('\n')) {
    if (line.startsWith('SF:')) {
      const file = line.slice(3)
      currentFile = PROJECT_SOURCE.test(file) ? file : ''
    } else if (!currentFile) {
      continue
    } else if (line.startsWith('LF:')) {
      const n = parseInt(line.slice(3), 10) || 0
      const entry = perFile.get(currentFile) ?? { lf: 0, lh: 0 }
      entry.lf = n
      perFile.set(currentFile, entry)
    } else if (line.startsWith('LH:')) {
      const n = parseInt(line.slice(3), 10) || 0
      const entry = perFile.get(currentFile) ?? { lf: 0, lh: 0 }
      entry.lh = n
      perFile.set(currentFile, entry)
    }
  }

  let totalLines = 0
  let coveredLines = 0
  for (const { lf, lh } of perFile.values()) {
    totalLines += lf
    coveredLines += lh
  }

  if (totalLines === 0 || perFile.size < MIN_SOURCE_FILES) return null

  return {
    percentage: (coveredLines / totalLines) * 100,
    totalLines,
    coveredLines
  }
}

function parseLcov(filePath: string): CoverageData | null {
  if (!existsSync(filePath)) return null
  return parseLcovContent(readFileSync(filePath, 'utf-8'))
}

/**
 * A lost shard drops hits from commonly-loaded code and can remove files only
 * it exercised, so an incomplete merge is not comparable with a whole one.
 * Reporting it against a whole baseline invents movement, and storing it
 * invents the movement back. Absent or unreadable metadata is therefore
 * treated as incomplete: the artifact has to prove it is whole before its
 * number is published.
 *
 * The baseline is held to the same bar, and must prove itself separately:
 * baselines stored before this gate existed carry no metadata at all, and
 * were saved from partial merges. Withholding one costs a single run of
 * silence, after which this run's own artifact becomes the baseline.
 *
 * Because incomplete merges never become baselines, a vetted baseline can be
 * several merges behind. It carries the commit it measured so the report can
 * say so rather than implying one PR caused the whole movement.
 */
function readE2eSnapshot(): CoverageSnapshot {
  const metadata = readCoverageMetadata(
    join(E2E_COVERAGE_DIR, COVERAGE_METADATA_FILE)
  )
  if (metadata?.complete !== true) return { current: null, baseline: null }

  const baseline = readCoverageMetadata(
    join(E2E_BASELINE_DIR, COVERAGE_METADATA_FILE)
  )
  const baselineIsWhole = baseline?.complete === true

  return {
    current: parseLcov(join(E2E_COVERAGE_DIR, 'coverage.lcov')),
    baseline: baselineIsWhole
      ? parseLcov(join(E2E_BASELINE_DIR, 'coverage.lcov'))
      : null,
    currentSha: metadata.sourceSha,
    baselineSha: baselineIsWhole ? baseline.sourceSha : undefined
  }
}

/**
 * Unit coverage is not assembled from shards here: the report job runs only
 * once every shard has passed, so there is no partial merge to detect. A run
 * that failed its coverage floor is still reported, and writes its tracefile
 * before asserting, so the only truncation risk is a crash mid-write — which
 * `MIN_SOURCE_FILES` catches when it is gross and tolerates when it is not.
 * The sidecar carries the span, and the workflow writes it only when the
 * baseline is not the direct parent.
 */
function readUnitSnapshot(): CoverageSnapshot {
  return {
    current: parseLcov(join(UNIT_COVERAGE_DIR, 'lcov.info')),
    baseline: parseLcov(join(UNIT_BASELINE_DIR, 'lcov.info')),
    currentSha: readCoverageMetadata(
      join(UNIT_COVERAGE_DIR, COVERAGE_METADATA_FILE)
    )?.sourceSha,
    baselineSha: readCoverageMetadata(
      join(UNIT_BASELINE_DIR, COVERAGE_METADATA_FILE)
    )?.sourceSha
  }
}

function shortSha(sha: string): string {
  return sha.slice(0, 7)
}

function progressBar(percentage: number): string {
  const clamped = Math.max(0, Math.min(100, percentage))
  const filled = Math.round((clamped / 100) * BAR_WIDTH)
  const empty = BAR_WIDTH - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

function formatPct(value: number): string {
  return value.toFixed(1) + '%'
}

function formatDelta(delta: number): string {
  const rounded = Math.abs(delta) < MIN_DELTA ? 0 : delta
  const sign = rounded >= 0 ? '+' : ''
  return sign + rounded.toFixed(1) + '%'
}

function crossedMilestone(prev: number, curr: number): number | null {
  const prevBucket = Math.floor(prev / MILESTONE_STEP)
  const currBucket = Math.floor(curr / MILESTONE_STEP)

  if (currBucket > prevBucket) {
    return currBucket * MILESTONE_STEP
  }
  return null
}

function buildMilestoneBlock(label: string, milestone: number): SlackBlock {
  if (milestone >= TARGET) {
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `🏆 *GOAL REACHED: ${label} coverage hit ${milestone}%!* 🏆`,
          `\`${progressBar(milestone)}\` ${milestone}% ✅`,
          'The team did it! 🎊🥳🎉'
        ].join('\n')
      }
    }
  }

  const remaining = TARGET - milestone
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: [
        `🎉🎉🎉 *MILESTONE: ${label} coverage hit ${milestone}%!*`,
        `\`${progressBar(milestone)}\` ${milestone}% → ${TARGET}% target`,
        `${remaining} percentage point${remaining !== 1 ? 's' : ''} to go!`
      ].join('\n')
    }
  }
}

function parseArgs(argv: string[]): ReportContext {
  let prUrl = ''
  let prNumber = ''
  let author = ''

  for (const arg of argv) {
    if (arg.startsWith('--pr-url=')) prUrl = arg.slice('--pr-url='.length)
    else if (arg.startsWith('--pr-number='))
      prNumber = arg.slice('--pr-number='.length)
    else if (arg.startsWith('--author=')) author = arg.slice('--author='.length)
  }

  return { prUrl, prNumber, author }
}

function formatCoverageRow(
  label: string,
  current: CoverageData,
  baseline: CoverageData
): string {
  const delta = current.percentage - baseline.percentage
  return `*${label}:*  ${formatPct(baseline.percentage)} → ${formatPct(current.percentage)}  (${formatDelta(delta)})`
}

interface MetricSource {
  label: string
  snapshot: CoverageSnapshot
  baselineDescription: string
}

interface ReportedMetric {
  label: string
  current: CoverageData
  baseline: CoverageData
  delta: number
  baselineDescription: string
  currentSha?: string
  baselineSha?: string
}

function reportable({
  label,
  snapshot,
  baselineDescription
}: MetricSource): ReportedMetric | null {
  const { current, baseline, currentSha, baselineSha } = snapshot
  if (current === null || baseline === null) return null
  const delta = current.percentage - baseline.percentage
  if (Math.abs(delta) < MIN_DELTA) return null
  return {
    label,
    current,
    baseline,
    delta,
    baselineDescription,
    currentSha,
    baselineSha
  }
}

function direction(deltas: number[]): Direction {
  if (deltas.every((delta) => delta > 0)) return 'up'
  if (deltas.every((delta) => delta < 0)) return 'down'
  return 'mixed'
}

/**
 * Names the commits a delta actually spans. Silent unless the baseline
 * identifies itself, so nothing is claimed that cannot be shown.
 */
function spanNote(metric: ReportedMetric): string | null {
  if (metric.baselineSha === undefined) return null

  const head =
    metric.currentSha === undefined
      ? ''
      : ` to \`${shortSha(metric.currentSha)}\``
  return `_${metric.label} measured from ${metric.baselineDescription} (\`${shortSha(metric.baselineSha)}\`)${head}; this span may cover several merges._`
}

function progressLine(label: string, data: CoverageData): string {
  return `\`${progressBar(data.percentage)}\` ${formatPct(data.percentage)} ${label} → ${TARGET}% target`
}

function milestoneBlock(
  label: string,
  { current, baseline }: CoverageSnapshot
): SlackBlock | null {
  if (current === null || baseline === null) return null
  const milestone = crossedMilestone(baseline.percentage, current.percentage)
  return milestone === null ? null : buildMilestoneBlock(label, milestone)
}

export function buildPayload(
  unit: CoverageSnapshot,
  e2e: CoverageSnapshot,
  context: ReportContext
): SlackPayload | null {
  const reported = [
    reportable({
      label: 'Unit',
      snapshot: unit,
      baselineDescription: 'the last measured merge'
    }),
    reportable({
      label: 'E2E',
      snapshot: e2e,
      baselineDescription: 'the last whole merge'
    })
  ].filter((metric): metric is ReportedMetric => metric !== null)

  if (reported.length === 0) return null

  const { icon, text } = HEADLINE[direction(reported.map((m) => m.delta))]

  const summaryLines: string[] = [
    `${icon} *${text}* — <${context.prUrl}|PR #${context.prNumber}> by <https://github.com/${context.author}|${context.author}>`,
    ''
  ]

  for (const metric of reported) {
    summaryLines.push(
      formatCoverageRow(metric.label, metric.current, metric.baseline)
    )
  }

  summaryLines.push('')

  if (unit.current) summaryLines.push(progressLine('unit', unit.current))
  if (e2e.current) summaryLines.push(progressLine('e2e', e2e.current))

  const spans = reported
    .map(spanNote)
    .filter((note): note is string => note !== null)
  if (spans.length > 0) summaryLines.push('', ...spans)

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: summaryLines.join('\n')
      }
    }
  ]

  const unitMilestone = milestoneBlock('Unit test', unit)
  if (unitMilestone) blocks.push(unitMilestone)

  const e2eMilestone = milestoneBlock('E2E test', e2e)
  if (e2eMilestone) blocks.push(e2eMilestone)

  return { text, blocks }
}

function main() {
  const context = parseArgs(process.argv.slice(2))

  const payload = buildPayload(readUnitSnapshot(), readE2eSnapshot(), context)
  if (payload === null) process.exit(0)

  process.stdout.write(JSON.stringify(payload))
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main()
}
