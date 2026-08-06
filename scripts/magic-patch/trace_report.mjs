/**
 * Where a conversion's time actually went.
 *
 *   tsx scripts/magic-patch/trace_report.mjs <db-dir>...
 *
 * Conversions take minutes each and it was guesswork which part. Anything that
 * dominates here is a candidate for computing once up front rather than on
 * demand — the point of the trace is to stop optimising by intuition.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

function traces(dir, depth = 0) {
  if (depth > 6) return []
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names.flatMap((name) => {
    const path = join(dir, name)
    try {
      if (statSync(path).isDirectory()) return traces(path, depth + 1)
      return name === 'trace.jsonl' ? [path] : []
    } catch {
      return []
    }
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const rows = process.argv
    .slice(2)
    .flatMap((dir) => traces(dir))
    .flatMap((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    )
  if (!rows.length) {
    console.error('No traces. Run a conversion first.')
    process.exit(0)
  }

  const byTool = new Map()
  for (const row of rows) {
    const entry = byTool.get(row.tool) ?? { calls: 0, ms: 0 }
    entry.calls++
    entry.ms += row.ms
    byTool.set(row.tool, entry)
  }
  const total = [...byTool.values()].reduce((sum, e) => sum + e.ms, 0)

  console.error(
    `${rows.length} tool call(s), ${(total / 1000).toFixed(1)}s in tools\n`
  )
  console.error('tool                    calls      total     mean    share')
  for (const [tool, e] of [...byTool].sort((a, b) => b[1].ms - a[1].ms)) {
    console.error(
      `${tool.padEnd(22)} ${String(e.calls).padStart(5)}  ${(e.ms / 1000).toFixed(1).padStart(8)}s ${(e.ms / e.calls / 1000).toFixed(1).padStart(7)}s ${((100 * e.ms) / total).toFixed(0).padStart(6)}%`
    )
  }
  console.error(
    '\nTime not shown here is the model thinking and writing — if tools are a\n' +
      'small share, the win is in the prompt, not the harness.'
  )
}
