import { appendFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { createGitLocationMapper } from './criticalCoverageGitDiff'
import {
  compareCriticalCoverageReports,
  readCriticalCoverageReport
} from './criticalCoverageReport'
import type { CriticalCoverageComparison } from './criticalCoverageReport'

interface Options {
  base: string
  head: string
}

interface GateResult {
  status: 'PASS' | 'FAIL'
  message: string
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  const summary = `## Critical Unit Coverage Gate: ERROR\n\n${message}`

  process.stderr.write(`${message}\n`)

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
  }

  process.exitCode = 1
}

function main(): void {
  const options = parseOptions(process.argv.slice(2))
  const base = readCriticalCoverageReport(options.base)
  const head = readCriticalCoverageReport(options.head)
  const comparison = compareCriticalCoverageReports(
    base,
    head,
    createGitLocationMapper(base.sha, head.sha)
  )
  const result = evaluateCoverageGate(comparison)
  const summary = formatComparison(comparison, result)

  process.stdout.write(`${summary}\n`)

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
  }

  if (result.status === 'FAIL') {
    process.stderr.write(`${result.message}\n`)
    process.exitCode = 1
  }
}

function parseOptions(args: string[]): Options {
  const { values: options } = parseArgs({
    args,
    options: {
      base: { type: 'string' },
      head: { type: 'string' }
    },
    strict: true,
    allowPositionals: false
  })

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

function evaluateCoverageGate(
  comparison: CriticalCoverageComparison
): GateResult {
  if (comparison.commonBranches === 0) {
    return {
      status: 'FAIL',
      message: `No comparable critical unit branches found (base: ${comparison.baseBranches}, head: ${comparison.headBranches}).`
    }
  }

  if (comparison.regressions.length > 0) {
    const regressionCount = comparison.regressions.length
    return {
      status: 'FAIL',
      message: `Critical unit coverage regressed on ${regressionCount} previously covered ${regressionCount === 1 ? 'branch' : 'branches'}.`
    }
  }

  return {
    status: 'PASS',
    message: 'Critical branch coverage did not regress.'
  }
}

function formatComparison(
  comparison: CriticalCoverageComparison,
  result: GateResult
): string {
  const lines = [
    `## Critical Unit Coverage Gate: ${result.status}`,
    '',
    `Base tested commit: \`${comparison.baseSha}\``,
    `PR tested commit: \`${comparison.headSha}\``,
    '',
    '| Metric | Count |',
    '|---|--:|',
    `| Base critical branches | ${comparison.baseBranches} |`,
    `| Head critical branches | ${comparison.headBranches} |`,
    `| Comparable critical branches | ${comparison.commonBranches} |`,
    `| Covered in base | ${comparison.commonCoveredBranchesInBase} |`,
    `| Covered in head | ${comparison.commonCoveredBranchesInHead} |`,
    `| Covered branch delta | ${formatSignedCount(comparison.coveredBranchDelta)} |`,
    `| Base-only branches | ${comparison.baseOnlyBranches} |`,
    `| Head-only branches | ${comparison.headOnlyBranches} |`,
    `| Covered-to-uncovered branches | ${comparison.regressions.length} |`,
    '',
    `${result.status}: ${result.message}`
  ]

  if (comparison.regressions.length === 0) {
    return lines.join('\n')
  }

  lines.push('')
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
  return value === null ? '-' : String(value)
}

function formatSignedCount(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}
