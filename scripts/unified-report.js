// @ts-check
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const args = process.argv.slice(2)

/** @param {string} name */
function getArg(name) {
  const prefix = `--${name}=`
  const arg = args.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

const sizeStatus = getArg('size-status') ?? 'pending'
const perfStatus = getArg('perf-status') ?? 'pending'

/** @type {string[]} */
const lines = []

// --- Size section ---
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

// --- Perf section ---
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

process.stdout.write(lines.join('\n') + '\n')
