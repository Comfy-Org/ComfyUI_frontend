import { existsSync, readFileSync } from 'node:fs'

const TARGET = 80
const MILESTONE_STEP = 5
const BAR_WIDTH = 20

interface CoverageData {
  percentage: number
  totalLines: number
  coveredLines: number
}

interface SlackBlock {
  type: 'section'
  text: {
    type: 'mrkdwn'
    text: string
  }
}

function parseLcovContent(content: string): CoverageData | null {
  let totalLines = 0
  let coveredLines = 0

  for (const line of content.split('\n')) {
    if (line.startsWith('LF:')) {
      totalLines += parseInt(line.slice(3), 10) || 0
    } else if (line.startsWith('LH:')) {
      coveredLines += parseInt(line.slice(3), 10) || 0
    }
  }

  if (totalLines === 0) return null

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
  const sign = delta >= 0 ? '+' : ''
  return sign + delta.toFixed(1) + '%'
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

function parseArgs(argv: string[]): {
  prUrl: string
  prNumber: string
  author: string
} {
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

function main() {
  const { prUrl, prNumber, author } = parseArgs(process.argv.slice(2))

  const unitCurrent = parseLcov('coverage/lcov.info')
  const unitBaseline = parseLcov('temp/coverage-baseline/lcov.info')
  const e2eCurrent = parseLcov('temp/e2e-coverage/coverage.lcov')
  const e2eBaseline = parseLcov('temp/e2e-coverage-baseline/coverage.lcov')

  const unitImproved =
    unitCurrent !== null &&
    unitBaseline !== null &&
    unitCurrent.percentage > unitBaseline.percentage

  const e2eImproved =
    e2eCurrent !== null &&
    e2eBaseline !== null &&
    e2eCurrent.percentage > e2eBaseline.percentage

  if (!unitImproved && !e2eImproved) {
    process.exit(0)
  }

  const blocks: SlackBlock[] = []

  const summaryLines: string[] = []
  summaryLines.push(
    `✅ *Coverage improved!* — <${prUrl}|PR #${prNumber}> by <https://github.com/${author}|${author}>`
  )
  summaryLines.push('')

  if (unitCurrent && unitBaseline) {
    summaryLines.push(formatCoverageRow('Unit', unitCurrent, unitBaseline))
  }

  if (e2eCurrent && e2eBaseline) {
    summaryLines.push(formatCoverageRow('E2E', e2eCurrent, e2eBaseline))
  }

  summaryLines.push('')

  if (unitCurrent) {
    summaryLines.push(
      `\`${progressBar(unitCurrent.percentage)}\` ${formatPct(unitCurrent.percentage)} unit → ${TARGET}% target`
    )
  }
  if (e2eCurrent) {
    summaryLines.push(
      `\`${progressBar(e2eCurrent.percentage)}\` ${formatPct(e2eCurrent.percentage)} e2e → ${TARGET}% target`
    )
  }

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: summaryLines.join('\n')
    }
  })

  if (unitCurrent && unitBaseline) {
    const milestone = crossedMilestone(
      unitBaseline.percentage,
      unitCurrent.percentage
    )
    if (milestone !== null) {
      blocks.push(buildMilestoneBlock('Unit test', milestone))
    }
  }

  if (e2eCurrent && e2eBaseline) {
    const milestone = crossedMilestone(
      e2eBaseline.percentage,
      e2eCurrent.percentage
    )
    if (milestone !== null) {
      blocks.push(buildMilestoneBlock('E2E test', milestone))
    }
  }

  const payload = { text: 'Coverage improved!', blocks }
  process.stdout.write(JSON.stringify(payload))
}

main()
