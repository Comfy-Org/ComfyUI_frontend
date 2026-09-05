import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const args: string[] = process.argv.slice(2)

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = args.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

const sizeStatus = getArg('size-status') ?? 'pending'
const perfStatus = getArg('perf-status') ?? 'pending'
const coverageStatus = getArg('coverage-status') ?? 'skip'

const lines: string[] = []

const hasSizeData = existsSync('temp/size')

if (sizeStatus === 'ready' && hasSizeData) {
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
} else if (sizeStatus !== 'ready') {
  lines.push('## 📦 Bundle Size')
  lines.push('')
  lines.push('> ⏳ Size data collection in progress…')
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
  } catch (error) {
    // A non-zero exit does not mean nothing was rendered: perf-report.ts writes
    // the whole report to stdout and only then sets a failing exit code. Keep
    // whatever it produced rather than replacing a complete report with a stub.
    const partial = (error as { stdout?: string | Buffer })?.stdout
    const rendered = typeof partial === 'string' ? partial.trimEnd() : ''
    if (rendered.length > 0) {
      lines.push(rendered)
    } else {
      lines.push('## ⚡ Performance')
      lines.push('')
      lines.push(
        '> ⚠️ Failed to render performance report. Check the CI workflow logs.'
      )
    }
  }
} else if (
  perfStatus === 'failed' ||
  (perfStatus === 'ready' && !existsSync('test-results/perf-metrics.json'))
) {
  lines.push('## ⚡ Performance')
  lines.push('')
  lines.push('> ⚠️ Performance tests failed. Check the CI workflow logs.')
} else if (perfStatus !== 'skip') {
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

process.stdout.write(lines.join('\n') + '\n')
