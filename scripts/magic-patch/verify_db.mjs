/**
 * Runs every conversion in a patch DB against the real pack and grades it.
 *
 *   tsx scripts/magic-patch/verify_db.mjs <db-dir> --corpus <dir>
 *
 * The DB records what an agent believed it did. This is the independent check:
 * each pack is loaded twice, as shipped and as converted, and only a *change*
 * in observable behaviour is reported. It is the difference between "the
 * conversion looked right" and "the pack still works".
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { applyUnifiedDiff } from '../../src/workbench/extensions/magicPatch/conversion/edits'
import { verifyPack } from './harness/verifyPack.mjs'

function entryFiles(dir, depth = 0) {
  // Deep enough for `<pack>/<sha>/<packRoot>/<nested dirs>/<file>.json`, which
  // is six levels before a pack's own directory nesting is counted. The cap only
  // exists to stop a symlink loop, so it announces itself rather than silently
  // returning a short list — a truncated walk here compiles an empty artifact
  // and reports success.
  if (depth > 12) {
    console.error(`warning: stopped descending at ${dir} (depth limit)`)
    return []
  }
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names.flatMap((name) => {
    const path = join(dir, name)
    try {
      if (statSync(path).isDirectory()) return entryFiles(path, depth + 1)
      return path.endsWith('.json') ? [path] : []
    } catch {
      return []
    }
  })
}

/**
 * How far a conversion has got, weakest first.
 *
 * **Validated means a ComfyUI human says it works.** Nothing else does, and in
 * particular this harness does not: it drives node lifecycle only — it clicks
 * nothing, renders nothing, and never calls a converted file's exported
 * helpers, which is how a broken `hideWidgetForGood` passed it earlier.
 *
 * So the harness can only ever *refuse*, never approve. It is a filter placed
 * in front of a person, not an authority in its own right, and no run of it can
 * promote an entry to `validated` — only `sign_off.mjs`, driven by a named
 * human, does that.
 */
export const VALIDATION = {
  /** Written and statically checked. Never executed. */
  none: 'none',
  /**
   * Loaded before and after; types, construction and wire compared. Necessary
   * before a human spends time on it, and nowhere near sufficient to ship.
   */
  harness: 'harness',
  /** A named human drove it in a real ComfyUI and said it works. */
  validated: 'validated'
}

/** Groups DB entries by pack, since verification is a whole-pack operation. */
function byPack(dbDir, corpus) {
  const packs = new Map()
  for (const file of entryFiles(dbDir)) {
    const entry = JSON.parse(readFileSync(file, 'utf8'))
    if (!entry.diff || !entry.pack) continue
    // entry.file is `<packDir>/<relative>`; the pack directory is its head.
    const [packDir, ...rest] = entry.file.split('/')
    const relative = rest.join('/')
    const packRoot = join(corpus, entry.pack, packDir)
    const existing = packs.get(packRoot) ?? {
      pack: entry.pack,
      packRoot,
      drafts: {}
    }
    const original = readFileSync(join(packRoot, relative), 'utf8')
    // `diff` names a sibling file rather than carrying the text inline.
    const diff = readFileSync(join(dirname(file), entry.diff), 'utf8')
    existing.drafts[relative] = applyUnifiedDiff(original, diff)
    existing.entryPaths = existing.entryPaths ?? []
    existing.entryPaths.push(file)
    packs.set(packRoot, existing)
  }
  return [...packs.values()]
}

/** Stamps the outcome onto every entry that took part in the run. */
function recordValidation(entryPaths, result) {
  for (const path of entryPaths ?? []) {
    let entry
    try {
      entry = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      continue
    }
    // Never stamps `validated`: a machine cannot promote itself to the tier
    // that means a person vouched for it. A previously signed-off entry that
    // now regresses loses that standing, because the code under it changed.
    entry.validation = result.regressed ? VALIDATION.none : VALIDATION.harness
    if (result.regressed) delete entry.validatedBy
    entry.validatedAgainst = {
      types: result.types?.length ?? 0,
      problems: result.problems ?? [],
      wireChanged: result.wireChanged ?? []
    }
    writeFileSync(path, JSON.stringify(entry, null, 2) + '\n')
  }
}

export async function verifyDb(dbDir, corpus) {
  const results = []
  for (const { pack, packRoot, drafts, entryPaths } of byPack(dbDir, corpus)) {
    // Every readable JS file, so a break that spans files is visible.
    const entries = []
    const walk = (dir, prefix = '') => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) {
          if (name !== 'node_modules') walk(path, `${prefix}${name}/`)
        } else if (name.endsWith('.js')) {
          entries.push(`${prefix}${name}`)
        }
      }
    }
    walk(packRoot)
    const outcome = await verifyPack({ pack, packRoot, entries, drafts }).catch(
      (error) => ({
        pack,
        regressed: true,
        problems: [`verification failed: ${error?.message ?? error}`],
        types: [],
        wireChanged: [],
        newErrors: [],
        before: {},
        after: {}
      })
    )
    recordValidation(entryPaths, outcome)
    results.push(outcome)
  }
  return results
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2)
  const dbDir = argv[0]
  const corpusIndex = argv.indexOf('--corpus')
  const corpus = corpusIndex === -1 ? null : argv[corpusIndex + 1]
  if (!dbDir || !corpus) {
    console.error('usage: verify_db.mjs <db-dir> --corpus <dir>')
    process.exit(2)
  }

  const results = await verifyDb(dbDir, corpus)
  let regressed = 0
  for (const r of results) {
    const verdict = r.regressed ? 'REGRESSED' : 'EQUIVALENT'
    if (r.regressed) regressed++
    console.error(`\n${verdict}  ${r.pack}  (${r.types.length} type(s) driven)`)
    for (const p of r.problems ?? []) console.error(`    problem: ${p}`)
    for (const e of r.newErrors ?? []) console.error(`    new error: ${e}`)
    for (const w of r.wireChanged ?? []) console.error(`    wire changed: ${w}`)
  }
  console.error(
    `\n${results.length - regressed}/${results.length} pack(s) equivalent`
  )
  process.exit(regressed ? 1 : 0)
}
