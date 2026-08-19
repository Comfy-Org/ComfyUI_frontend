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
 * Usage: node scripts/magic-patch/pack_status.mjs <db-dir> [--table] [--list]
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
 * Nothing the frontend loads, so nothing to convert.
 *
 * A pack's own Vitest suite mocks `scripts/app.js` — the old surface appears in
 * the mock, describing what the pack's source uses. It runs in the pack's CI,
 * never in ComfyUI. Build output under `dist/`, or carrying a bundler's content
 * hash, is regenerated from source we convert instead; editing the artefact
 * would be overwritten by the pack's next build.
 *
 * The hash arm insists on both a capital and a digit. Length alone matched
 * `mask-rect-area-advanced.js` and `widget-event-handlers.js`, because
 * "advanced" and "handlers" are eight letters long.
 */
const GENERATED_OR_TEST =
  /(?:^|\/)(?:dist|build)\/|(?:^|\/)tests?\/|\.(?:test|spec)\.js$|-(?=[A-Za-z0-9_-]*[A-Z])(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{8}\.js$/

/**
 * Comments are not uses.
 *
 * Several files reached the work list on the strength of a single line their
 * own author had already commented out — `// import { api } from
 * '/scripts/api.js'`. Counting that as a use of the API put a file nobody
 * needed to touch in front of someone to touch.
 *
 * Under-stripping is the safe direction here: leaving a comment in can only
 * keep a file in scope for a human to dismiss, while over-stripping would drop
 * real work silently. Regex literals are therefore left alone.
 */
function withoutComments(text) {
  let out = ''
  let index = 0
  const quotes = new Set(['"', "'", '`'])

  while (index < text.length) {
    const char = text[index]

    if (char === '/' && text[index + 1] === '/') {
      const end = text.indexOf('\n', index)
      index = end === -1 ? text.length : end
    } else if (char === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2)
      index = end === -1 ? text.length : end + 2
    } else if (quotes.has(char)) {
      let cursor = index + 1
      while (cursor < text.length && text[cursor] !== char) {
        cursor += text[cursor] === '\\' ? 2 : 1
      }
      out += text.slice(index, cursor + 1)
      index = cursor + 1
    } else {
      out += char
      index += 1
    }
  }
  return out
}

/**
 * A gutted file is one whose whole body was replaced by a comment block. Two
 * lines of slack covers a lone `export {}` or an import the block still refers
 * to. An imported function that is invoked is executable registration, not
 * slack.
 *
 * Being gutted says nothing about WHY, and that distinction is the whole point:
 * counting shape rather than decision reported 86 files as "refused" when 5 of
 * them were decisions and 75 were work nobody had finished. A gap is not a
 * refusal. A refusal is a refusal.
 */
const GUTTED_CODE_LINES = 2

/** A decision was taken: this will not be supported. */
const REFUSAL = /^\s*\/\/\s*(?:REFUSED|UNSUPPORTED)\b/m
const INOPERABLE = /^\s*\/\/\s*INOPERABLE:/m
const NOTHING_INOPERABLE = /^\s*\/\/\s*INOPERABLE:\s*nothing\b/im

/**
 * Something wanted that nothing published serves yet.
 *
 * Outranks a refusal in the same file. A block that refuses one technique and
 * still wants three others is unfinished, whatever else it says.
 *
 * It outranks a conversion for the same reason. A file that got one export out
 * of ten across the line and left nine of these behind is not finished either,
 * and counting it beside the finished ones hid 459 open markers in 208 files
 * that the headline was calling converted.
 *
 * The comment style is not part of the declaration. Conversions that write
 * their reasoning as one `/* *\/` header state the gap on a bare line inside
 * it, and demanding `//` counted four such files as converted while they were
 * still asking for API. What marks a declaration is that it opens the line —
 * prose naming the vocabulary mid-sentence is not one.
 */
const OUTSTANDING = /^\s*(?:\/\/|\*)?\s*(?:API-GAP|PUNTED IN FULL)\b/m

const codeLines = (text) =>
  text
    .split('\n')
    .filter((line) => line.trim() && !/^\s*(?:\/\/|\/\*|\*)/.test(line)).length

function invokesNamedImport(text) {
  const code = withoutComments(text)
  const bindings = [...code.matchAll(/^\s*import\s*\{([^}]+)\}\s*from\b/gm)]
    .flatMap((match) => match[1].split(','))
    .map((binding) =>
      binding
        .trim()
        .split(/\s+as\s+/)
        .at(-1)
    )
    .filter(Boolean)
  return bindings.some((binding) =>
    new RegExp(`^\\s*${binding}\\s*\\(`, 'm').test(code)
  )
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
        const file = relative(converted, destination)
        if (GENERATED_OR_TEST.test(file)) continue
        if (!OLD_SURFACE.test(withoutComments(original))) continue

        const stats = packs.get(pack) ?? {
          converted: 0,
          refused: 0,
          outstanding: 0,
          todo: []
        }
        const gutted =
          codeLines(result) <= GUTTED_CODE_LINES && !invokesNamedImport(result)
        if (original === result) stats.todo.push({ file, why: 'untouched' })
        else if (OUTSTANDING.test(result))
          stats.todo.push({ file, why: gutted ? 'gap' : 'partial' })
        else if (!gutted) stats.converted++
        else if (REFUSAL.test(result)) stats.refused++
        else if (NOTHING_INOPERABLE.test(result)) stats.converted++
        else if (INOPERABLE.test(result)) stats.refused++
        // Gutted, and saying neither. Not a decision, so it is work.
        else stats.todo.push({ file, why: 'silent' })
        stats.outstanding = stats.todo.length
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
    console.error('usage: pack_status.mjs <db-dir> [--table] [--list]')
    process.exit(1)
  }
  const { packs, totals, settled } = packStatus(dbDir)
  const partial = [...packs.values()].reduce(
    (sum, stats) =>
      sum + stats.todo.filter((entry) => entry.why === 'partial').length,
    0
  )
  console.error(
    `${packs.size} packs. Of the files whose original touches the old surface: ` +
      `${totals.converted} finished, ${totals.refused} refused by decision, ` +
      `${totals.outstanding} outstanding — of which ${partial} converted ` +
      `something and left an open marker behind. ${settled} of ${packs.size} ` +
      `packs have nothing outstanding.`
  )
  const byOutstanding = [...packs].sort(
    (a, b) => b[1].outstanding - a[1].outstanding
  )

  if (flags.includes('--table')) {
    console.error('\npack                                  conv  refused  todo')
    for (const [pack, stats] of byOutstanding) {
      console.error(
        `${pack.padEnd(36)} ${String(stats.converted).padStart(5)}  ` +
          `${String(stats.refused).padStart(7)}  ${String(stats.outstanding).padStart(4)}`
      )
    }
  }

  // The work list comes off the same classifier as the count, so the two
  // cannot drift apart.
  if (flags.includes('--list')) {
    for (const [pack, stats] of byOutstanding) {
      if (!stats.outstanding) continue
      console.error(`\n${pack}`)
      for (const { file, why } of stats.todo) {
        console.error(`  ${why.padEnd(9)} ${file}`)
      }
    }
  }
}
