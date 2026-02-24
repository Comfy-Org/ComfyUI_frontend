// @ts-check
import { existsSync, readFileSync } from 'node:fs'

/**
 * @typedef {Object} PerfMeasurement
 * @property {string} name
 * @property {number} durationMs
 * @property {number} styleRecalcs
 * @property {number} styleRecalcDurationMs
 * @property {number} layouts
 * @property {number} layoutDurationMs
 * @property {number} taskDurationMs
 * @property {number} heapDeltaBytes
 */

/**
 * @typedef {Object} PerfReport
 * @property {string} timestamp
 * @property {string} gitSha
 * @property {string} branch
 * @property {PerfMeasurement[]} measurements
 */

const CURRENT_PATH = 'test-results/perf-metrics.json'
const BASELINE_PATH = 'temp/perf-baseline/perf-metrics.json'

/** @param {number} pct */
function formatDelta(pct) {
  if (pct >= 20) return `+${pct.toFixed(0)}% 🔴`
  if (pct >= 10) return `+${pct.toFixed(0)}% 🟠`
  if (pct > -10) return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% ⚪`
  return `${pct.toFixed(0)}% 🟢`
}

/** @param {number} bytes */
function formatBytes(bytes) {
  if (Math.abs(bytes) < 1024) return `${bytes} B`
  if (Math.abs(bytes) < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function main() {
  if (!existsSync(CURRENT_PATH)) {
    process.stdout.write(
      '## ⚡ Performance Report\n\nNo perf metrics found. Perf tests may not have run.\n'
    )
    process.exit(0)
  }

  /** @type {PerfReport} */
  const current = JSON.parse(readFileSync(CURRENT_PATH, 'utf-8'))

  /** @type {PerfReport | null} */
  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
    : null

  const lines = []
  lines.push('## ⚡ Performance Report\n')

  if (baseline) {
    lines.push(
      '| Metric | Baseline | PR | Δ |',
      '|--------|----------|-----|---|'
    )

    for (const m of current.measurements) {
      const base = baseline.measurements.find((b) => b.name === m.name)
      if (!base) {
        lines.push(
          `| ${m.name}: style recalcs | — | ${m.styleRecalcs} | new |`
        )
        lines.push(`| ${m.name}: layouts | — | ${m.layouts} | new |`)
        continue
      }

      // Style recalcs
      const recalcPct =
        base.styleRecalcs > 0
          ? ((m.styleRecalcs - base.styleRecalcs) / base.styleRecalcs) * 100
          : 0
      lines.push(
        `| ${m.name}: style recalcs | ${base.styleRecalcs} | ${m.styleRecalcs} | ${formatDelta(recalcPct)} |`
      )

      // Layouts
      const layoutPct =
        base.layouts > 0
          ? ((m.layouts - base.layouts) / base.layouts) * 100
          : 0
      lines.push(
        `| ${m.name}: layouts | ${base.layouts} | ${m.layouts} | ${formatDelta(layoutPct)} |`
      )

      // Task duration
      const taskPct =
        base.taskDurationMs > 0
          ? ((m.taskDurationMs - base.taskDurationMs) / base.taskDurationMs) *
            100
          : 0
      lines.push(
        `| ${m.name}: task duration | ${base.taskDurationMs.toFixed(0)}ms | ${m.taskDurationMs.toFixed(0)}ms | ${formatDelta(taskPct)} |`
      )
    }
  } else {
    lines.push(
      'No baseline found — showing absolute values.\n',
      '| Metric | Value |',
      '|--------|-------|'
    )
    for (const m of current.measurements) {
      lines.push(`| ${m.name}: style recalcs | ${m.styleRecalcs} |`)
      lines.push(`| ${m.name}: layouts | ${m.layouts} |`)
      lines.push(
        `| ${m.name}: task duration | ${m.taskDurationMs.toFixed(0)}ms |`
      )
      lines.push(`| ${m.name}: heap delta | ${formatBytes(m.heapDeltaBytes)} |`)
    }
  }

  lines.push('\n<details><summary>Raw data</summary>\n')
  lines.push('```json')
  lines.push(JSON.stringify(current, null, 2))
  lines.push('```')
  lines.push('\n</details>')

  process.stdout.write(lines.join('\n') + '\n')
}

main()
