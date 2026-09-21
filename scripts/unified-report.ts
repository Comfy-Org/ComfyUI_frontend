import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

import { renderPrReportSection } from './cicd/prReportSection'

const args: string[] = process.argv.slice(2)

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = args.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

const sizeStatus = getArg('size-status') ?? 'pending'
const perfStatus = getArg('perf-status') ?? 'pending'
const coverageStatus = getArg('coverage-status') ?? 'skip'

function bundleStatusLine(status: string): string {
  return renderPrReportSection({ icon: '📦', title: 'Bundle', status })
}

function perfStatusLine(status: string): string {
  return renderPrReportSection({ icon: '⚡', title: 'Performance', status })
}

function coverageStatusLine(status: string): string {
  return renderPrReportSection({ icon: '🔬', title: 'E2E Coverage', status })
}

const lines: string[] = []

const hasSizeData = existsSync('temp/size')

if (sizeStatus === 'ready' && hasSizeData) {
  try {
    const sizeReport = execFileSync('node', ['scripts/size-report.js'], {
      encoding: 'utf-8'
    }).trimEnd()
    lines.push(sizeReport)
  } catch {
    lines.push(
      bundleStatusLine(
        '⚠️ Failed to render report — check the CI workflow logs'
      )
    )
  }
} else if (sizeStatus === 'failed') {
  lines.push(
    bundleStatusLine(
      '⚠️ Size data collection failed — check the CI workflow logs'
    )
  )
} else if (sizeStatus !== 'ready') {
  lines.push(bundleStatusLine('⏳ Size data collection in progress…'))
}

if (lines.length > 0) lines.push('')

if (perfStatus === 'ready' && existsSync('test-results/perf-metrics.json')) {
  try {
    const perfReport = execFileSync(
      'pnpm',
      ['exec', 'tsx', 'scripts/perf-report.ts'],
      { encoding: 'utf-8' }
    ).trimEnd()
    lines.push(perfReport)
  } catch {
    lines.push(
      perfStatusLine('⚠️ Failed to render report — check the CI workflow logs')
    )
  }
} else if (
  perfStatus === 'failed' ||
  (perfStatus === 'ready' && !existsSync('test-results/perf-metrics.json'))
) {
  lines.push(
    perfStatusLine('⚠️ Performance tests failed — check the CI workflow logs')
  )
} else if (perfStatus !== 'skip') {
  lines.push(perfStatusLine('⏳ Performance tests in progress…'))
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
    lines.push(
      coverageStatusLine(
        '⚠️ Failed to render report — check the CI workflow logs'
      )
    )
  }
} else if (coverageStatus === 'failed') {
  lines.push('')
  lines.push(
    coverageStatusLine(
      '⚠️ Coverage collection failed — check the CI workflow logs'
    )
  )
}

process.stdout.write(lines.join('\n') + '\n')
