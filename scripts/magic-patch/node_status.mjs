#!/usr/bin/env node
/**
 * Per-node support, and the pack grade that follows from it.
 *
 * A pack is finished when every node it customises is in one of two terminal
 * states: we support what the node was trying to do, or we have decided we will
 * not and said so. There is no third state. A node sitting behind an `API-GAP:`
 * is not finished — it is a decision nobody has taken, and counting it as
 * "converted with a documented gap" made a work list look like an outcome.
 *
 * The unit is the node, not the file. A file can be half-converted and still
 * leave every node it touches working; a file can convert cleanly and leave a
 * node inoperable. Only the node is what a user has or does not have.
 *
 * Markers this reads:
 *
 *   // INOPERABLE: <what stopped working> — <why>    (also: UNSUPPORTED:)
 *       Terminal. The node wants something that fights the system or reaches
 *       somewhere dangerous, so it is inoperable and will not be supported.
 *       `INOPERABLE: nothing` is a file declaring it broke no node.
 *   // COSMETIC: <what was lost>
 *       A loss that changes appearance and not behaviour. Lets a pack grade as
 *       fully supported for everything that functions.
 *
 * Usage: node scripts/magic-patch/node_status.mjs <db-dir> [--pack NAME] [--undecided]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Where an original names a node type it customises.
 *
 * A partial view on purpose, and the report says so rather than dividing by it.
 * Packs name types through wrapped constants — rgthree's
 * `CONTEXT: addRgthree("Context")` yields "Context (rgthree)" only if you run
 * the function — through computed arrays, and through `NODE_CLASS_MAPPINGS` in
 * Python, which this database does not contain at all. A denominator built
 * from these patterns reported rgthree as having four nodes. It has dozens.
 */
const DECLARES = [
  /nodeData\.name\s*===?\s*['"]([^'"]+)['"]/g,
  /nodeType\.comfyClass\s*===?\s*['"]([^'"]+)['"]/g,
  /registerNodeType\(\s*['"]([^'"]+)['"]/g,
  /comfyClass\s*[:=]\s*['"]([^'"]+)['"]/g
]

/** Where a conversion says it handles one. */
const HANDLES = [
  /defs\.extend\(\s*['"]([^'"]+)['"]/g,
  /defs\.define\(\s*\{[^}]*?type:\s*['"]([^'"]+)['"]/gs
]
const HANDLES_ARRAY = /defs\.extend\(\s*\[([\s\S]*?)\]\s*,/g
const HANDLES_CONSTANT = [
  /defs\.extend\(\s*([A-Za-z_$][\w$]*)\s*,/g,
  /defs\.define\(\s*\{[^}]*?type:\s*([A-Za-z_$][\w$]*)/gs
]
const STRING_CONSTANT =
  /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])([^'"\r\n]*)\2/g

/**
 * A type named through a constant — `NodeTypesString.CONTEXT` — which this
 * cannot resolve without evaluating the pack. Counted and reported rather than
 * silently dropped, because a coverage number nobody can see is a lie.
 */
const INDIRECT =
  /(?:defs\.extend|nodeData\.name\s*===?)\s*\(?\s*([A-Z][\w$]*\.[\w$]+)/g

/**
 * What a conversion declares it has stopped working.
 *
 * `INOPERABLE:` is the word the corpus actually settled on — 22 uses against
 * zero for `UNSUPPORTED:`, which is what this scan used to look for alone. So
 * the grade that decides whether a pack is fully converted found no declared
 * losses anywhere, while twenty-two declarations sat in the files under a name
 * it did not know. Both are read now; the corpus's own word leads.
 *
 * The subject is not always a node type. It is sometimes a feature ("Workflow
 * Image Export, both PNG and SVG"), and sometimes the literal word "nothing",
 * which is a file saying it broke no node at all — the opposite of a loss, and
 * counted as one if the word is taken as a name.
 */
const UNSUPPORTED = /^\s*\/\/\s*(?:INOPERABLE|UNSUPPORTED):\s*(.+)$/gm
const NOTHING_LOST = /^nothing\b/i
const COSMETIC = /^\s*\/\/\s*COSMETIC:/m
const LOSS = /^\s*\/\/\s*(?:DROPPED|LIMITATION):/m

const stripComments = (source) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
    .join('\n')

const matchAll = (text, patterns) =>
  patterns.flatMap((pattern) => [...text.matchAll(pattern)].map(([, n]) => n))

export function handledTypes(source) {
  const constants = new Map(
    [...source.matchAll(STRING_CONSTANT)].map(([, name, , value]) => [
      name,
      value
    ])
  )
  const resolvedConstants = matchAll(source, HANDLES_CONSTANT)
    .map((name) => constants.get(name))
    .filter(Boolean)

  return [
    ...new Set([
      ...matchAll(source, HANDLES),
      ...[...source.matchAll(HANDLES_ARRAY)].flatMap(([, body]) =>
        [...body.matchAll(/['"]([^'"]+)['"]/g)].map(([, type]) => type)
      ),
      ...resolvedConstants
    ])
  ]
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

export function nodeStatus(dbDir) {
  const packs = new Map()

  for (const pack of readdirSync(dbDir)) {
    if (pack.startsWith('.')) continue
    const packDir = join(dbDir, pack)
    if (!statSync(packDir).isDirectory()) continue

    const declared = new Set()
    const handled = new Set()
    const unsupported = new Set()
    let indirect = 0
    let cosmeticOnly = true
    let anyLoss = false

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

        for (const type of matchAll(stripComments(original), DECLARES)) {
          declared.add(type)
        }
        indirect += [...stripComments(original).matchAll(INDIRECT)].length

        if (original === converted) continue
        for (const type of handledTypes(stripComments(converted))) {
          handled.add(type)
        }
        for (const [, subject] of converted.matchAll(UNSUPPORTED)) {
          const named = subject.trim().replace(/[.,;]$/, '')
          if (!NOTHING_LOST.test(named)) unsupported.add(named)
        }
        if (LOSS.test(converted)) {
          anyLoss = true
          if (!COSMETIC.test(converted)) cosmeticOnly = false
        }
      }
    }

    if (!declared.size && !handled.size) continue
    // Only types this can see BOTH sides of. A type the original named and the
    // conversion does not is a candidate for undecided; a type named only
    // through a constant appears in neither set and is counted as unseen.
    const undecided = [...declared].filter(
      (type) => !handled.has(type) && !unsupported.has(type)
    )
    packs.set(pack, {
      handled: [...handled],
      unsupported: [...unsupported],
      undecided,
      indirect,
      grade: grade({ undecided, unsupported, anyLoss, cosmeticOnly })
    })
  }
  return packs
}

/**
 * `undecided` outranks everything: a pack with an undecided node has not been
 * graded, and reporting it as "partial" would imply someone chose.
 */
function grade({ undecided, unsupported, anyLoss, cosmeticOnly }) {
  if (undecided.length) return 'UNDECIDED'
  if (unsupported.length) return 'PARTIAL'
  if (anyLoss && cosmeticOnly) return 'FULL (non-cosmetic)'
  if (anyLoss) return 'PARTIAL'
  return 'FULL'
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const dbDir = args.find((a) => !a.startsWith('--'))
  const at = args.indexOf('--pack')
  const wantPack = at === -1 ? undefined : args[at + 1]
  if (!dbDir) {
    console.error('usage: node_status.mjs <db-dir> [--pack NAME] [--undecided]')
    process.exit(1)
  }

  const packs = nodeStatus(dbDir)
  const rows = [...packs].filter(([p]) => !wantPack || p.includes(wantPack))

  if (args.includes('--undecided')) {
    console.error(
      '\nTypes the original named and the conversion neither handles nor refuses\n'
    )
    for (const [pack, s] of rows.sort(
      (a, b) => b[1].undecided.length - a[1].undecided.length
    )) {
      if (!s.undecided.length) continue
      console.error(`${pack}  (${s.undecided.length})`)
      console.error(`    ${s.undecided.join(', ')}`)
    }
    process.exit(0)
  }

  const tally = new Map()
  console.error(
    '\npack                                  grade         handled  unsupported  undecided'
  )
  for (const [pack, s] of rows.sort((a, b) => a[0].localeCompare(b[0]))) {
    tally.set(s.grade, (tally.get(s.grade) ?? 0) + 1)
    console.error(
      `${pack.padEnd(36)} ${s.grade.padEnd(13)} ${String(s.handled.length).padStart(7)}  ${String(s.unsupported.length).padStart(11)}  ${String(s.undecided.length).padStart(9)}`
    )
  }
  console.error('')
  for (const [g, n] of [...tally].sort((a, b) => b[1] - a[1])) {
    console.error(`${String(n).padStart(4)} pack(s)  ${g}`)
  }
  console.error(
    `\nCounts are node TYPES this can see in JS, never a pack's node list — ` +
      `that lives in NODE_CLASS_MAPPINGS, which this database does not hold. ` +
      `A node with no frontend JS is untouched by the migration and needs no ` +
      `grade; one named only through an imported or computed constant is ` +
      `invisible here and does.`
  )
  console.error(
    `\nA grade below FULL is provisional until a human has declared what broke. ` +
      `This once read that nothing in the corpus used these markers, which ` +
      `stopped being true without the sentence changing: the corpus writes ` +
      `INOPERABLE:, and the scan only knew UNSUPPORTED:.`
  )
}
