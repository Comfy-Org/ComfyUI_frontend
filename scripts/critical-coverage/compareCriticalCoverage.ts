import { appendFileSync } from 'node:fs'

import {
  compareCriticalCoverageReports,
  readCriticalCoverageReport
} from './criticalCoverageReport'
import type { CriticalCoverageComparison } from './criticalCoverageReport'

interface Options {
  base: string
  head: string
}

const options = parseOptions(process.argv.slice(2))
const base = readCriticalCoverageReport(options.base)
const head = readCriticalCoverageReport(options.head)
const comparison = compareCriticalCoverageReports(base, head)
const summary = formatComparison(comparison)

process.stdout.write(`${summary}\n`)

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
}

if (comparison.commonBranches === 0) {
  process.stderr.write('No comparable critical unit branches found.\n')
  process.exit(1)
}

if (comparison.coveredBranchDelta < 0) {
  process.stderr.write(
    `Critical unit coverage dropped by ${Math.abs(comparison.coveredBranchDelta)} covered branches on the shared branch set.\n`
  )
  process.exit(1)
}

function parseOptions(args: string[]): Options {
  const options: Partial<Options> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const next = args[i + 1]

    if (arg === '--base' && next) {
      options.base = next
      i++
    } else if (arg.startsWith('--base=')) {
      options.base = arg.slice('--base='.length)
    } else if (arg === '--head' && next) {
      options.head = next
      i++
    } else if (arg.startsWith('--head=')) {
      options.head = arg.slice('--head='.length)
    }
  }

  if (!options.base || !options.head) {
    throw new Error(
      'Usage: compareCriticalCoverage --base <json> --head <json>'
    )
  }

  return {
    base: options.base,
    head: options.head
  }
}

function formatComparison(comparison: CriticalCoverageComparison): string {
  const passed = comparison.coveredBranchDelta >= 0
  const lines = [
    `## Critical Unit Coverage Gate: ${passed ? 'PASS' : 'FAIL'}`,
    '',
    `Base tested commit: \`${comparison.baseSha}\``,
    `PR tested commit: \`${comparison.headSha}\``,
    '',
    '| Metric | Count |',
    '|---|--:|',
    `| Comparable critical branches | ${comparison.commonBranches} |`,
    `| Covered in base | ${comparison.commonCoveredBranchesInBase} |`,
    `| Covered in head | ${comparison.commonCoveredBranchesInHead} |`,
    `| Covered branch delta | ${formatSignedCount(comparison.coveredBranchDelta)} |`,
    `| Base-only branches | ${comparison.baseOnlyBranches} |`,
    `| Head-only branches | ${comparison.headOnlyBranches} |`,
    `| Covered-to-uncovered branches | ${comparison.regressions.length} |`,
    ''
  ]

  if (passed) {
    lines.push('PASS: Critical branch coverage did not decrease.')
    return lines.join('\n')
  }

  lines.push('| File | Line | Branch | Base | Head |')
  lines.push('|---|--:|---|--:|--:|')

  for (const regression of comparison.regressions.slice(0, 25)) {
    lines.push(
      `| \`${regression.file}\` | ${regression.line} | ${regression.block}:${regression.branch} | ${formatTaken(regression.baseTaken)} | ${formatTaken(regression.headTaken)} |`
    )
  }

  if (comparison.regressions.length > 25) {
    lines.push('')
    lines.push(
      `${comparison.regressions.length - 25} additional regressions omitted from this summary.`
    )
  }

  return lines.join('\n')
}

function formatTaken(value: number | null): string {
  return value === null ? '0' : String(value)
}

function formatSignedCount(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}
