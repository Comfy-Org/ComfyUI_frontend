/**
 * Compiles the patch database into the single artifact the client ships with.
 *
 *   node <tsx> scripts/magic-patch/compile_db.mjs db/ --out dist/nodes_patches.json
 *
 * The two layouts answer different questions, which is why this step exists at
 * all rather than the DB being the artifact:
 *
 *   db/<pack>/<commit7>/<file>.json    ← organised for humans and git
 *   nodes_patches.json  { <sourceSha256>: entry }   ← organised for the runtime
 *
 * A reviewer asks "what did we do to rgthree at d4e5317?" and wants a directory
 * they can diff. The client asks "I have these bytes — is there a patch?" and
 * has no idea which pack or commit they came from. Compiling inverts the index.
 *
 * The content hash is the safety property: an entry can only ever apply to the
 * exact bytes it was verified against, so a pack that updated silently gets no
 * patch rather than a mis-applied one.
 */
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { RULE_CATALOG_VERSION } from '../../src/workbench/extensions/magicPatch/conversion/rules'

const FORMAT_VERSION = 1

function entries(dir, depth = 0) {
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
      if (statSync(path).isDirectory()) return entries(path, depth + 1)
      return path.endsWith('.json') ? [path] : []
    } catch {
      return []
    }
  })
}

/**
 * Compiles a DB directory into the artifact shape.
 *
 * Exported so tests and the dev harness can load the folder directly instead of
 * building an artifact first — the folder is the source of truth, the artifact
 * is a packaging step.
 */
/**
 * Tiers that may ship.
 *
 * "Patched" and "patched and known to work" are different artifacts, and an
 * entry that carries no verdict is the former. Absent evidence is not weak
 * evidence — an unstamped entry has never been executed, so it is treated as
 * `none` and refused. Shipping it would mean shipping a conversion no one has
 * ever run, under a badge that says we validated it.
 */
const SHIPPABLE = new Set(['harness', 'manual'])

export function compileDb(root, { allowUnvalidated = false } = {}) {
  const patches = {}
  const problems = []
  const stats = {
    files: 0,
    packs: new Set(),
    byAuthor: {},
    skipped: 0,
    unvalidated: 0
  }
  collect(root, patches, problems, stats, allowUnvalidated)
  return {
    artifact: {
      formatVersion: FORMAT_VERSION,
      ruleCatalogVersion: RULE_CATALOG_VERSION,
      // No timestamp: the artifact must be byte-reproducible from the same DB,
      // so a rebuild that changes nothing produces no diff.
      patches: Object.fromEntries(
        Object.entries(patches).sort(([a], [b]) => a.localeCompare(b))
      )
    },
    problems,
    stats
  }
}

function collect(root, patches, problems, stats, allowUnvalidated) {
  for (const path of entries(root)) {
    stats.files++
    let entry
    try {
      entry = JSON.parse(readFileSync(path, 'utf8'))
    } catch (error) {
      problems.push(`${path}: unreadable — ${error.message}`)
      continue
    }

    for (const field of ['pack', 'file', 'sourceSha256', 'apiMajor', 'diff']) {
      if (entry[field] === undefined) {
        problems.push(`${path}: missing ${field}`)
      }
    }
    if (problems.length && problems.at(-1)?.startsWith(path)) continue

    // A conversion built against an older catalog may target APIs that have since
    // changed shape. Drop it rather than shipping something unverifiable.
    if (entry.ruleCatalogVersion !== RULE_CATALOG_VERSION) {
      stats.skipped++
      problems.push(
        `${path}: built against rule catalog v${entry.ruleCatalogVersion}, ` +
          `current is v${RULE_CATALOG_VERSION} — regenerate`
      )
      continue
    }

    // Verification is carried in the artifact, not just in CI logs, so the client
    // can refuse an entry whose wire check did not hold and a reviewer sees the
    // evidence inline.
    if (entry.verified?.wireIdentical === false) {
      stats.skipped++
      problems.push(`${path}: wire format changed — not shippable`)
      continue
    }

    const validation = entry.validation ?? 'none'
    if (!SHIPPABLE.has(validation)) {
      stats.unvalidated++
      if (!allowUnvalidated) {
        stats.skipped++
        problems.push(
          `${path}: validation=${validation} — never executed, not shippable ` +
            `(run verify_db, or pass --allow-unvalidated to ship anyway)`
        )
        continue
      }
    }

    const existing = patches[entry.sourceSha256]
    if (existing && existing.diff !== entry.diff) {
      // Identical bytes in two packs (a vendored helper, a fork) must convert the
      // same way. Disagreement means one of them is wrong.
      problems.push(
        `${entry.sourceSha256.slice(0, 12)}: conflicting patches — ` +
          `${existing.pack}/${existing.file} vs ${entry.pack}/${entry.file}`
      )
      continue
    }

    patches[entry.sourceSha256] = {
      pack: entry.pack,
      file: entry.file,
      commit: entry.commit ?? null,
      apiMajor: entry.apiMajor,
      author: entry.author ?? 'unknown',
      rules: entry.rules ?? [],
      verified: entry.verified ?? {},
      // Carried through so the client can say which kind of patch it applied.
      // A badge that cannot distinguish the two tiers is worse than none.
      validation,
      // Inlined into the artifact: the client has one file, not a directory.
      diff: readFileSync(join(dirname(path), entry.diff), 'utf8')
    }
    stats.packs.add(entry.pack)
    stats.byAuthor[entry.author ?? 'unknown'] =
      (stats.byAuthor[entry.author ?? 'unknown'] ?? 0) + 1
  }
}

// ---- CLI ----------------------------------------------------------------
// Guarded: importing `compileDb` from a test must not execute the CLI, which
// would parse the test runner's argv and exit the process.

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2)
  const root = argv[0]
  const outIndex = argv.indexOf('--out')
  const out = outIndex === -1 ? null : argv[outIndex + 1]
  const allowUnvalidated = argv.includes('--allow-unvalidated')
  if (!root || !out) {
    console.error('usage: compile_db.mjs <db-dir> --out <artifact.json>')
    process.exit(2)
  }

  const { artifact, problems, stats } = compileDb(root, { allowUnvalidated })
  if (stats.unvalidated) {
    console.error(
      allowUnvalidated
        ? `WARNING: shipping ${stats.unvalidated} unvalidated patch(es) — ` +
            `--allow-unvalidated was passed`
        : `Held back ${stats.unvalidated} unvalidated patch(es).`
    )
  }

  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify(artifact, null, 2) + '\n')

  const size = Buffer.byteLength(JSON.stringify(artifact))
  console.error(
    `${Object.keys(artifact.patches).length} patch(es) from ${stats.packs.size} pack(s), ` +
      `${(size / 1024).toFixed(1)} KiB`
  )
  for (const [author, count] of Object.entries(stats.byAuthor).sort()) {
    console.error(`  ${String(count).padStart(4)}  ${author}`)
  }
  if (stats.skipped) console.error(`  ${stats.skipped} skipped`)

  if (problems.length) {
    console.error(`\n${problems.length} problem(s):`)
    for (const problem of problems.slice(0, 40)) console.error(`  ${problem}`)
    if (problems.length > 40)
      console.error(`  ...and ${problems.length - 40} more`)
    process.exit(1)
  }
}
