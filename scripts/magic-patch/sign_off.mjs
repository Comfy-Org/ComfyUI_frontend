/**
 * Records that a named human drove a converted pack in a real ComfyUI and says
 * it works.
 *
 *   tsx scripts/magic-patch/sign_off.mjs <db-dir> --pack <name> --by <who>
 *                                        [--notes "..."] [--file <relative>]
 *
 * This is the only route to `validation: validated`, and `compile_db` ships
 * nothing else. `verify_db` cannot grant it: the harness drives node lifecycle
 * and no more — it clicks nothing and renders nothing — so a pack can pass it
 * and still be visibly broken. Only a person who opened the workflow knows.
 *
 * The test plan the person is expected to have followed is
 * `docs/magic_patch_test_plan_WIP.md`.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

function entryFiles(dir, depth = 0) {
  if (depth > 12) return []
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
    } catch {
      return []
    }
    return name.endsWith('.json') ? [path] : []
  })
}

/**
 * Signs off every entry of a pack, or one file of it.
 *
 * Refuses an entry the harness has not passed. Sign-off is a person's judgement
 * about behaviour, not a way to route around the automated check — if the wire
 * format moved or a node stopped constructing, that is a defect to fix rather
 * than to vouch for.
 */
export function signOff(dbDir, { pack, by, notes, file, at }) {
  const signed = []
  const refused = []

  for (const path of entryFiles(dbDir)) {
    let entry
    try {
      entry = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      continue
    }
    if (entry.pack !== pack) continue
    if (file && !entry.file?.endsWith(file)) continue

    if (entry.validation !== 'harness' && entry.validation !== 'validated') {
      refused.push(`${entry.file}: validation=${entry.validation ?? 'none'}`)
      continue
    }

    entry.validation = 'validated'
    entry.validatedBy = { who: by, at, notes: notes ?? null }
    writeFileSync(path, JSON.stringify(entry, null, 2) + '\n')
    signed.push(entry.file)
  }

  return { signed, refused }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2)
  const value = (flag) => {
    const i = argv.indexOf(flag)
    return i === -1 ? undefined : argv[i + 1]
  }
  const dbDir = argv[0]
  const pack = value('--pack')
  const by = value('--by')

  if (!dbDir || !pack || !by) {
    console.error(
      'usage: sign_off.mjs <db-dir> --pack <name> --by <who> ' +
        '[--notes "..."] [--file <relative>]'
    )
    process.exit(2)
  }

  const { signed, refused } = signOff(dbDir, {
    pack,
    by,
    notes: value('--notes'),
    file: value('--file'),
    at: new Date().toISOString()
  })

  for (const line of refused) {
    console.error(`refused ${line} — run verify_db first`)
  }
  console.error(`Signed off ${signed.length} entr(ies) in ${pack} as ${by}.`)
  if (!signed.length) process.exit(1)
}
