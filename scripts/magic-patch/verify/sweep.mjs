/**
 * Runs the conformance checker over every converted pack in `db/`.
 *
 * A destination file counts as converted when it differs from its source —
 * NOT by the presence of a `/comfy/api/v2.js` import. A correct conversion
 * that needs nothing from `comfy` legitimately has no import, and using the
 * marker as the test mis-reported three whole packs as outstanding.
 *
 * Usage: pnpm tsx scripts/magic-patch/verify/sweep.mjs [pack-name-substring]
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

import { runConformance } from '../../../src/workbench/extensions/magicPatch/verify/conformance'

const DB = join(process.cwd(), 'db')
const SCRATCH = join(mkdtempSync(join(tmpdir(), 'sweep-')), 'chk.mjs')

/**
 * `node --check x.js` exits 0 on a syntactically broken ESM file — node
 * retries the parse as ESM and swallows the error. Only the `.mjs` extension
 * makes it report honestly, so the source is copied before checking.
 */
function syntaxError(source) {
  writeFileSync(SCRATCH, source)
  try {
    execFileSync(process.execPath, ['--check', SCRATCH], { stdio: 'pipe' })
    return undefined
  } catch (error) {
    const text = String(error?.stderr ?? error)
    return text.split('\n').find((line) => line.includes('Error')) ?? 'invalid'
  }
}

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.js') ? [full] : []
  })
}

const only = process.argv[2]
const failures = []
const sanctioned = []
let passed = 0

const directories = (dir) =>
  readdirSync(dir).filter((entry) => statSync(join(dir, entry)).isDirectory())

for (const pack of directories(DB)) {
  if (only && !pack.includes(only)) continue
  // The snapshot dir is usually xHEAD, but not always — kjnodes is xe97a7b.
  for (const snap of directories(join(DB, pack))) {
    const head = join(DB, pack, snap)
    const v2 = join(head, 'v2')
    if (!existsSync(v2)) continue

    for (const converted of walk(v2)) {
      const rel = relative(v2, converted)
      const original = join(head, rel)
      if (!existsSync(original)) continue

      const body = readFileSync(converted, 'utf8')
      if (body === readFileSync(original, 'utf8')) continue

      const broken = syntaxError(body)
      if (broken) {
        failures.push(`${pack}/${rel}\n    does not parse as ESM: ${broken}`)
        continue
      }

      const { results } = runConformance({
        pack,
        file: rel,
        original: readFileSync(original, 'utf8'),
        converted: body,
        edits: []
      })

      const bad = results.filter((c) => c.status === 'failed')
      const label = `${pack}/${rel}`
      if (!bad.length) passed++
      else if (body.includes('SANCTIONED-HOLDOUT'))
        sanctioned.push(`${label} — ${bad.map((c) => c.id).join(', ')}`)
      else
        failures.push(
          `${label}\n    ${bad.map((c) => `${c.id}: ${c.detail}`).join('\n    ')}`
        )
    }
  }
}

console.log(
  `passed ${passed}  sanctioned ${sanctioned.length}  FAILED ${failures.length}`
)
for (const s of sanctioned) console.log(`  sanctioned  ${s}`)
for (const f of failures) console.log(`  FAILED  ${f}`)
