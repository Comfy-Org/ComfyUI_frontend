#!/usr/bin/env node
/**
 * Every behaviour a conversion set aside, and everything it set aside without
 * saying so.
 *
 * A conversion may drop behaviour — some of it cannot be expressed yet, some of
 * it should not be. What it may not do is drop behaviour *silently*, because a
 * marker is the only record that survives into review, and an unmarked drop is
 * indistinguishable from an oversight. Nothing aggregated these before, so 643
 * markers across 290 files were reviewable only by opening 290 files.
 *
 * Two reports:
 *
 *   MARKED    every marker, grouped by kind, so a whole class of decision can be
 *             re-read at once when the API changes under it.
 *   UNMARKED  exports and user-visible strings present in the original, gone
 *             from the conversion, and explained in none of its comments.
 *             These are the silent drops.
 *
 * Usage:
 *   node scripts/magic-patch/dropped_report.mjs <db-dir> [--kind DROPPED] [--pack rgthree] [--unmarked]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * The vocabulary, and what each word is for.
 *
 * Listed so drift is visible: the same fact has been filed as `DROPPED`,
 * `LIMITATION` and `REFUSED, not a gap` in different files, which makes any one
 * of them useless as a search. Anything outside this set is reported under
 * UNKNOWN rather than ignored — a marker nobody can grep for is not a marker.
 */
const KINDS = {
  'API-GAP': 'Wanted, no published destination yet.',
  REFUSED: 'Deliberately not published. A decision, not a backlog item.',
  DROPPED: 'Behaviour the conversion does not reproduce.',
  'WIRE FORMAT': 'The saved workflow or queued prompt changed.',
  'SANCTIONED-HOLDOUT': 'Old surface retained on purpose, with an owner.',
  LIMITATION: 'Converted, but narrower than the original.',
  // node_status.mjs has graded on this since packs started being graded
  // "full support for non-cosmetic functionality", but this report did not
  // know the word, so a cosmetic drop counted towards a pack's grade while
  // never appearing in the list of what was dropped.
  COSMETIC: 'Lost, and only appearance: an icon, a colour, a glyph.',
  'SCRIPT-VISIBLE': "Behaviour a pack's own scripting surface can see.",
  'PUNTED IN FULL':
    'Whole file abandoned. NOT terminal — every node it served ' +
    'still needs supporting or declaring unsupported.',
  'REFUSED IN FULL': 'Whole file abandoned by decision rather than by blocker.'
}

/** Bookkeeping about other markers, not markers about behaviour. */
const STATUS_WORDS = new Set([
  'NOT A GAP',
  'NO LONGER A GAP',
  'ALSO NO LONGER A GAP',
  'SOLVED',
  'STILL BLOCKED',
  'STILL OPEN'
])

/** The pack's own comments, which we did not write and must not count. */
const THEIR_WORDS = new Set([
  'TODO',
  'FIXME',
  'NOTE',
  'XXX',
  'HACK',
  'IMPORTANT',
  'DEBUG',
  'OPTIMIZE',
  'HOTFIX',
  'NOOP',
  'HANDLE'
])

/**
 * An em-dash counts as a separator, not just a colon.
 *
 * The first version required `:`, `(` or `,` and so could not see a single
 * `PUNTED IN FULL —` line. That is the most severe marker there is — a whole
 * file abandoned — and 24 of them were invisible to a report whose entire
 * purpose is that nothing is invisible.
 */
const MARKER = /^\s*\/\/\s*([A-Z][A-Z0-9 _-]{2,28}?)\s*(?:\(|:|,|—|--\s)/

/**
 * What counts as lost functionality, as opposed to lost code.
 *
 * The first attempt at this flagged every top-level name the original declared
 * and the conversion did not: 6,945 of them across 446 files, which is not a
 * report, it is noise. An honest rewrite drops internal names by the dozen —
 * a hand-drawn scrollbar's PREVIEW_SCROLLBAR_TRACK_WIDTH *should* disappear
 * with the drawing. Two narrower signals say something a reviewer can act on.
 */

/** An export is a contract: another file in the pack may be relying on it. */
const EXPORTED =
  /^\s*export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm

/**
 * A human-readable string literal — a menu label, a toast, an error the user
 * reads. If one of these is gone, something the user could see is gone with it.
 * Capitalised and multi-word on purpose: that is what separates a label from an
 * identifier, a css class or a node type.
 */
const USER_VISIBLE = /['"]([A-Z][A-Za-z0-9]+(?: [A-Za-z0-9/&'-]+){1,6})['"]/g

const stripComments = (source) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
    .join('\n')

const commentsOnly = (source) =>
  source
    .split('\n')
    .filter((line) => /^\s*(?:\/\/|\/\*|\*)/.test(line))
    .join('\n')

function lostThings(original) {
  const code = stripComments(original)
  return {
    exports: [...code.matchAll(EXPORTED)].map(([, name]) => name),
    labels: [...new Set([...code.matchAll(USER_VISIBLE)].map(([, l]) => l))]
  }
}

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
    if (entry.isDirectory()) return jsFiles(path, depth + 1)
    return entry.isFile() && entry.name.endsWith('.js') ? [path] : []
  })
}

export function scanDropped(dbDir) {
  const markers = []
  const unmarked = []

  for (const pack of readdirSync(dbDir)) {
    if (pack.startsWith('.')) continue
    const packDir = join(dbDir, pack)
    if (!statSync(packDir).isDirectory()) continue

    for (const snapshot of readdirSync(packDir)) {
      const snapshotDir = join(packDir, snapshot)
      const convertedDir = join(snapshotDir, 'v2')
      try {
        if (!statSync(convertedDir).isDirectory()) continue
      } catch {
        continue
      }

      for (const destination of jsFiles(convertedDir)) {
        const rel = relative(convertedDir, destination)
        const source = join(snapshotDir, rel)
        let original
        let converted
        try {
          original = readFileSync(source, 'utf8')
          converted = readFileSync(destination, 'utf8')
        } catch {
          continue
        }
        if (original === converted) continue

        converted.split('\n').forEach((line, index) => {
          const match = MARKER.exec(line)
          if (!match) return
          const word = match[1].trim()
          if (THEIR_WORDS.has(word) || STATUS_WORDS.has(word)) return
          markers.push({
            pack,
            file: rel,
            line: index + 1,
            kind: word in KINDS ? word : 'UNKNOWN',
            word,
            text: line.trim().replace(/^\/\/\s*/, '')
          })
        })

        // Gone from the conversion's code AND unmentioned in its comments.
        // Checking comments rather than markers specifically is deliberate: an
        // explanation is what review needs, and demanding a particular word
        // would only teach people the word.
        const { exports, labels } = lostThings(original)
        const after = stripComments(converted)
        const explained = commentsOnly(converted)
        const missing = (name) =>
          !after.includes(name) && !explained.includes(name)
        const lostExports = exports.filter(missing)
        const lostLabels = labels.filter(missing)
        if (lostExports.length || lostLabels.length) {
          unmarked.push({ pack, file: rel, lostExports, lostLabels })
        }
      }
    }
  }
  return { markers, unmarked }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const dbDir = args.find((a) => !a.startsWith('--'))
  const flag = (name) => {
    const at = args.indexOf(`--${name}`)
    return at === -1 ? undefined : args[at + 1]
  }
  if (!dbDir) {
    console.error(
      'usage: dropped_report.mjs <db-dir> [--kind KIND] [--pack NAME] [--unmarked]'
    )
    process.exit(1)
  }

  const { markers, unmarked } = scanDropped(dbDir)
  const wantKind = flag('kind')
  const wantPack = flag('pack')
  const chosen = markers.filter(
    (m) =>
      (!wantKind || m.kind === wantKind.toUpperCase()) &&
      (!wantPack || m.pack.includes(wantPack))
  )

  if (args.includes('--unmarked')) {
    const scoped = unmarked.filter(
      (u) => !wantPack || u.pack.includes(wantPack)
    )
    console.error(
      `\nUNMARKED — in the original, gone from the conversion, explained ` +
        `nowhere\n`
    )
    const weight = (e) => e.lostExports.length * 10 + e.lostLabels.length
    for (const entry of scoped.sort((a, b) => weight(b) - weight(a))) {
      console.error(`${entry.pack}/${entry.file}`)
      if (entry.lostExports.length) {
        console.error(`    exports  ${entry.lostExports.join(', ')}`)
      }
      if (entry.lostLabels.length) {
        console.error(
          `    visible  ${entry.lostLabels.map((l) => `"${l}"`).join(', ')}`
        )
      }
    }
    const totals = scoped.reduce(
      (sum, e) => ({
        exports: sum.exports + e.lostExports.length,
        labels: sum.labels + e.lostLabels.length
      }),
      { exports: 0, labels: 0 }
    )
    console.error(
      `\n${totals.exports} export(s) and ${totals.labels} user-visible ` +
        `string(s) across ${scoped.length} file(s), dropped with no explanation.`
    )
    process.exit(0)
  }

  const byKind = new Map()
  for (const m of chosen) byKind.set(m.kind, (byKind.get(m.kind) ?? 0) + 1)

  console.error('\nMARKED\n')
  console.error('kind                  count  meaning')
  for (const [kind, count] of [...byKind].sort((a, b) => b[1] - a[1])) {
    console.error(
      `${kind.padEnd(20)} ${String(count).padStart(6)}  ${KINDS[kind] ?? 'Not in the vocabulary — cannot be searched for reliably.'}`
    )
  }

  if (wantKind || wantPack) {
    console.error('')
    for (const m of chosen) {
      console.error(`${m.pack}/${m.file}:${m.line}`)
      console.error(`    ${m.text.slice(0, 150)}`)
    }
  } else {
    console.error(
      `\n${markers.length} marker(s). Filter with --kind or --pack; ` +
        `--unmarked lists what was dropped without one.`
    )
  }
}
