#!/usr/bin/env node
/**
 * Compares each converted file against its original and reports behaviour a
 * conversion silently dropped.
 *
 * The marker tally cannot see these. A conversion that loses authentication
 * writes no `API-GAP:` comment, because the agent did not notice — so it never
 * reaches a report, and every downstream count says the file is done. Both
 * classes below were found by hand after an agent happened to mention one in
 * passing.
 *
 * Usage: node scripts/magic-patch/verify/regressions.mjs [db-root]
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2] ?? 'db'

const SKIP = new Set(['.git', 'node_modules'])

function* jsFiles(dir) {
  // withFileTypes so a symlink is never followed: `db` itself is one, and a
  // link pointing back up the tree walks forever.
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* jsFiles(path)
    else if (entry.isFile() && entry.name.endsWith('.js')) yield path
  }
}

const read = (path) => readFileSync(path, 'utf8')
const count = (text, pattern) => (text.match(pattern) ?? []).length

const FETCH_API = /\bfetchApi\s*\(/g
const BACKEND_FETCH = /backend\.fetch\s*\(/g
const PLAIN_FETCH = /(?<![.\w])fetch\s*\(/g
const BARE_ROOT_FETCH = /(?<![.\w])fetch\s*\(\s*[`'"](\/[^`'"]*)/g
/**
 * A file nobody converted cannot have regressed.
 *
 * Tested without a regex: a punt is comments plus `export {}`, and the obvious
 * pattern for that nests a quantified alternation, which backtracks forever on
 * the minified bundles some packs ship.
 */
function isConverted(text) {
  if (text.trimEnd().endsWith('export {}')) return false
  return /nodeApi|import \{ comfy|from '@comfy/.test(text)
}

const authDropped = []
const routePrefixed = []

for (const dest of jsFiles(root)) {
  if (!dest.includes('/v2/')) continue
  const src = dest.replace('/v2/', '/')
  let original
  try {
    original = read(src)
  } catch {
    continue
  }
  const converted = read(dest)
  if (!isConverted(converted)) continue

  const wasAuthed = count(original, FETCH_API)
  const stillAuthed = count(converted, BACKEND_FETCH)
  const plain = count(converted, PLAIN_FETCH) - stillAuthed
  if (wasAuthed && stillAuthed < wasAuthed && plain > 0) {
    authDropped.push({ dest, wasAuthed, stillAuthed })
  }

  const bare = [...original.matchAll(BARE_ROOT_FETCH)].map((m) => m[1])
  if (bare.length && /backend\.(url|fetch)\s*\(/.test(converted)) {
    routePrefixed.push({ dest, routes: [...new Set(bare)].slice(0, 4) })
  }
}

function report(title, rows, describe) {
  console.log(`\n${title}: ${rows.length}`)
  for (const row of rows) console.log(`  ${describe(row)}`)
}

report(
  'Authentication dropped (original used api.fetchApi, conversion uses bare fetch)',
  authDropped,
  (r) => `${relative(root, r.dest)}  [${r.stillAuthed}/${r.wasAuthed} kept]`
)
report(
  'Root-relative route may have gained an /api prefix it never had',
  routePrefixed,
  (r) => `${relative(root, r.dest)}  ${r.routes.join(' ')}`
)

// Only the first class is a definite regression. The second depends on whether
// ComfyUI dual-mounts custom node routes, which cannot be settled from here.
process.exit(authDropped.length ? 1 : 0)
