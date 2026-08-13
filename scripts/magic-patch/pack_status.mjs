#!/usr/bin/env node
/**
 * Counts what is converted, refused and outstanding across the corpus.
 *
 * These three numbers head the database README, and until now they were
 * computed by hand. They were wrong twice — once counting files that were
 * never in scope, once matching `_nodes` inside `selected_nodes` — and a
 * number nobody can reproduce goes stale without anyone noticing. The rule is
 * written down here instead, so the README can be regenerated and disagreed
 * with.
 *
 * Usage: node scripts/magic-patch/pack_status.mjs <db-dir> [--table]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * A file is in scope when its ORIGINAL reaches for the surface being retired.
 *
 * Scoped to the original on purpose: a converted file no longer matches, so
 * testing the destination would shrink the denominator every time work landed
 * and the percentage would climb on its own.
 */
const OLD_SURFACE =
  /\bapp\.(?:registerExtension|graph|canvas|ui|extensionManager|queuePrompt)\b|\bLiteGraph\b|\bLGraphNode\b|\bLGraphCanvas\b|\bapi\.(?:fetchApi|addEventListener|queuePrompt)\b|\/scripts\/(?:app|api|widgets|domWidget)\.js|\bComfyWidgets\b|\bnodeType\.prototype\b/

/**
 * A refusal is a file whose whole body was replaced by a gap block, so what is
 * left is the explanation and nothing else. Two lines of slack covers a lone
 * `export {}` or an import the gap block still refers to.
 */
const REFUSAL_CODE_LINES = 2

const codeLines = (text) =>
  text
    .split('\n')
    .filter((line) => line.trim() && !/^\s*(?:\/\/|\/\*|\*)/.test(line)).length

function jsFiles(dir, depth = 0) {
  if (depth > 10) return []
  let entries = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name)
    // withFileTypes so a symlinked directory is not followed into a loop.
    if (entry.isDirectory()) return jsFiles(path, depth + 1)
    return entry.isFile() && entry.name.endsWith('.js') ? [path] : []
  })
}

export function packStatus(dbDir) {
  const packs = new Map()

  for (const pack of readdirSync(dbDir)) {
    if (pack.startsWith('.')) continue
    const packDir = join(dbDir, pack)
    if (!statSync(packDir).isDirectory()) continue

    for (const snapshot of readdirSync(packDir)) {
      const snapshotDir = join(packDir, snapshot)
      const converted = join(snapshotDir, 'v2')
      try {
        if (!statSync(converted).isDirectory()) continue
      } catch {
        continue
      }

      for (const destination of jsFiles(converted)) {
        const source = join(snapshotDir, relative(converted, destination))
        let original
        let result
        try {
          original = readFileSync(source, 'utf8')
          result = readFileSync(destination, 'utf8')
        } catch {
          continue
        }
        if (!OLD_SURFACE.test(original)) continue

        const stats = packs.get(pack) ?? {
          converted: 0,
          refused: 0,
          outstanding: 0
        }
        if (original === result) stats.outstanding++
        else if (codeLines(result) <= REFUSAL_CODE_LINES) stats.refused++
        else stats.converted++
        packs.set(pack, stats)
      }
    }
  }

  const totals = [...packs.values()].reduce(
    (sum, stats) => ({
      converted: sum.converted + stats.converted,
      refused: sum.refused + stats.refused,
      outstanding: sum.outstanding + stats.outstanding
    }),
    { converted: 0, refused: 0, outstanding: 0 }
  )
  const settled = [...packs.values()].filter(
    (stats) => stats.outstanding === 0
  ).length

  return { packs, totals, settled }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dbDir, ...flags] = process.argv.slice(2)
  if (!dbDir) {
    console.error('usage: pack_status.mjs <db-dir> [--table]')
    process.exit(1)
  }
  const { packs, totals, settled } = packStatus(dbDir)
  console.error(
    `${packs.size} packs. Of the files whose original touches the old surface: ` +
      `${totals.converted} converted, ${totals.refused} refused with a ` +
      `documented gap, ${totals.outstanding} still to do. ${settled} of ` +
      `${packs.size} packs have no source left to convert.`
  )
  if (!flags.includes('--table')) process.exit(0)

  console.error('\npack                                  conv  refused  todo')
  for (const [pack, stats] of [...packs].sort(
    (a, b) => b[1].outstanding - a[1].outstanding
  )) {
    console.error(
      `${pack.padEnd(36)} ${String(stats.converted).padStart(5)}  ` +
        `${String(stats.refused).padStart(7)}  ${String(stats.outstanding).padStart(4)}`
    )
  }
}
