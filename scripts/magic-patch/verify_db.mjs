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
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { applyEdits } from '../../src/workbench/extensions/magicPatch/conversion/edits'
import { verifyPack } from './harness/verifyPack.mjs'

function entryFiles(dir, depth = 0) {
  if (depth > 4) return []
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
      return path.endsWith('.json') && !path.endsWith('ledger.jsonl') ? [path] : []
    } catch {
      return []
    }
  })
}

/** Groups DB entries by pack, since verification is a whole-pack operation. */
function byPack(dbDir, corpus) {
  const packs = new Map()
  for (const file of entryFiles(dbDir)) {
    const entry = JSON.parse(readFileSync(file, 'utf8'))
    if (!entry.edits || !entry.pack) continue
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
    existing.drafts[relative] = applyEdits(original, entry.edits)
    packs.set(packRoot, existing)
  }
  return [...packs.values()]
}

export async function verifyDb(dbDir, corpus) {
  const results = []
  for (const { pack, packRoot, drafts } of byPack(dbDir, corpus)) {
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
    results.push(
      await verifyPack({ pack, packRoot, entries, drafts }).catch((error) => ({
        pack,
        regressed: true,
        problems: [`verification failed: ${error?.message ?? error}`],
        types: [],
        wireChanged: [],
        newErrors: [],
        before: {},
        after: {}
      }))
    )
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
