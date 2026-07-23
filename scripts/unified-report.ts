import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'

import { CRITICAL_COVERAGE_DIRS } from './criticalCoverageDirs'

const args: string[] = process.argv.slice(2)

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = args.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

const sizeStatus = getArg('size-status') ?? 'pending'
const perfStatus = getArg('perf-status') ?? 'pending'
const coverageStatus = getArg('coverage-status') ?? 'skip'
const criticalCoverageStatus = getArg('critical-coverage-status') ?? 'skip'

export type CoverageMetricName =
  | 'statements'
  | 'branches'
  | 'functions'
  | 'lines'
export type CoverageMetric = {
  total: number
  covered: number
  pct: number
}
// json-summary output: a 'total' entry plus one entry per covered file,
// all sharing the same metric shape
export type CoverageSummary = Record<
  string,
  Partial<Record<CoverageMetricName, CoverageMetric>> | undefined
>

const COVERAGE_METRIC_NAMES: CoverageMetricName[] = [
  'statements',
  'branches',
  'functions',
  'lines'
]

export function formatCoverageMetric(metric?: CoverageMetric): string {
  if (
    !metric ||
    !Number.isFinite(metric.covered) ||
    !Number.isFinite(metric.total) ||
    !Number.isFinite(metric.pct)
  ) {
    return 'N/A | N/A'
  }

  return `${metric.covered}/${metric.total} | ${metric.pct.toFixed(2)}%`
}

function isCriticalFile(filePath: string): boolean {
  // json-summary keys are absolute; anchor them to the repo root so a
  // critical dir can only match at the start of the relative path, never
  // mid-path (e.g. a nested `**/src/composables/`).
  const repoRelative = relative(process.cwd(), filePath).replaceAll('\\', '/')
  return CRITICAL_COVERAGE_DIRS.some((dir) =>
    repoRelative.startsWith(`${dir}/`)
  )
}

// The coverage run spans all of src (a single run, per #13423), so the
// critical slice is aggregated here from the per-file entries rather than
// read off summary.total.
export function computeCriticalCoverageTotals(
  summary: CoverageSummary
): Partial<Record<CoverageMetricName, CoverageMetric>> {
  const totals: Partial<Record<CoverageMetricName, CoverageMetric>> = {}
  for (const [filePath, metrics] of Object.entries(summary)) {
    if (filePath === 'total' || !metrics || !isCriticalFile(filePath)) continue
    for (const name of COVERAGE_METRIC_NAMES) {
      const metric = metrics[name]
      if (!metric) continue
      const acc = (totals[name] ??= { covered: 0, total: 0, pct: 0 })
      acc.covered += metric.covered
      acc.total += metric.total
    }
  }
  for (const name of COVERAGE_METRIC_NAMES) {
    const acc = totals[name]
    if (acc) acc.pct = acc.total === 0 ? 100 : (acc.covered / acc.total) * 100
  }
  return totals
}

export function renderCriticalCoverageReport(
  summary: CoverageSummary = JSON.parse(
    readFileSync('temp/critical-coverage/coverage-summary.json', 'utf-8')
  ) as CoverageSummary
): string {
  const totals = computeCriticalCoverageTotals(summary)
  const rows: Array<[string, CoverageMetricName]> = [
    ['Statements', 'statements'],
    ['Branches', 'branches'],
    ['Functions', 'functions'],
    ['Lines', 'lines']
  ]

  return [
    '## Critical Unit Coverage',
    '',
    '| Metric | Covered | Coverage |',
    '|---|---:|---:|',
    ...rows.map(([label, key]) => {
      return `| ${label} | ${formatCoverageMetric(totals[key])} |`
    })
  ].join('\n')
}

const lines: string[] = []

if (sizeStatus === 'ready') {
  try {
    const sizeReport = execFileSync('node', ['scripts/size-report.js'], {
      encoding: 'utf-8'
    }).trimEnd()
    lines.push(sizeReport)
  } catch {
    lines.push('## 📦 Bundle Size')
    lines.push('')
    lines.push(
      '> ⚠️ Failed to render bundle size report. Check the CI workflow logs.'
    )
  }
} else if (sizeStatus === 'failed') {
  lines.push('## 📦 Bundle Size')
  lines.push('')
  lines.push('> ⚠️ Size data collection failed. Check the CI workflow logs.')
} else {
  lines.push('## 📦 Bundle Size')
  lines.push('')
  lines.push('> ⏳ Size data collection in progress…')
}

lines.push('')

if (perfStatus === 'ready' && existsSync('test-results/perf-metrics.json')) {
  try {
    const perfReport = execFileSync(
      'pnpm',
      ['exec', 'tsx', 'scripts/perf-report.ts'],
      { encoding: 'utf-8' }
    ).trimEnd()
    lines.push(perfReport)
  } catch {
    lines.push('## ⚡ Performance')
    lines.push('')
    lines.push(
      '> ⚠️ Failed to render performance report. Check the CI workflow logs.'
    )
  }
} else if (
  perfStatus === 'failed' ||
  (perfStatus === 'ready' && !existsSync('test-results/perf-metrics.json'))
) {
  lines.push('## ⚡ Performance')
  lines.push('')
  lines.push('> ⚠️ Performance tests failed. Check the CI workflow logs.')
} else {
  lines.push('## ⚡ Performance')
  lines.push('')
  lines.push('> ⏳ Performance tests in progress…')
}

if (coverageStatus === 'ready' && existsSync('temp/coverage/coverage.lcov')) {
  try {
    const coverageReport = execFileSync(
      'pnpm',
      [
        'exec',
        'tsx',
        'scripts/coverage-report.ts',
        'temp/coverage/coverage.lcov'
      ],
      { encoding: 'utf-8' }
    ).trimEnd()
    lines.push('')
    lines.push(coverageReport)
  } catch {
    lines.push('')
    lines.push('## 🔬 E2E Coverage')
    lines.push('')
    lines.push(
      '> ⚠️ Failed to render coverage report. Check the CI workflow logs.'
    )
  }
} else if (coverageStatus === 'failed') {
  lines.push('')
  lines.push('## 🔬 E2E Coverage')
  lines.push('')
  lines.push('> ⚠️ Coverage collection failed. Check the CI workflow logs.')
}

if (
  (criticalCoverageStatus === 'ready' || criticalCoverageStatus === 'failed') &&
  existsSync('temp/critical-coverage/coverage-summary.json')
) {
  try {
    lines.push('')
    lines.push(renderCriticalCoverageReport())
  } catch {
    lines.push('')
    lines.push('## Critical Unit Coverage')
    lines.push('')
    lines.push(
      '> Failed to render critical coverage summary. Check the CI workflow logs.'
    )
  }
} else if (criticalCoverageStatus === 'ready') {
  lines.push('')
  lines.push('## Critical Unit Coverage')
  lines.push('')
  lines.push('> Critical coverage summary unavailable.')
} else if (criticalCoverageStatus === 'failed') {
  lines.push('')
  lines.push('## Critical Unit Coverage')
  lines.push('')
  lines.push('> Critical coverage gate failed. Check the CI workflow logs.')
} else if (criticalCoverageStatus === 'pending') {
  lines.push('')
  lines.push('## Critical Unit Coverage')
  lines.push('')
  lines.push('> Critical coverage gate is still running.')
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.stdout.write(lines.join('\n') + '\n')
}
