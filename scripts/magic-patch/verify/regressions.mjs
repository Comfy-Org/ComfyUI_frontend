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
import { dirname, join, relative, resolve } from 'node:path'

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

/**
 * Routes, not counts.
 *
 * Counting calls flagged a pack whose one authenticated route lived inside a
 * monkey-patch the conversion punted: the route is not in the conversion at
 * all, so nothing was downgraded. Only a route that survives into the
 * conversion *unauthenticated* is a regression.
 */
const AUTHED_ROUTE = /\bfetchApi\s*\(\s*[`'"]([^`'"]*)/g
const BACKEND_FETCH_ROUTE = /backend\.fetch\s*\(\s*[`'"]([^`'"]*)/g
const PLAIN_FETCH_ROUTE = /(?<![.\w])fetch\s*\(\s*[`'"]([^`'"]*)/g
const BARE_ROOT_FETCH = /(?<![.\w])fetch\s*\(\s*[`'"](\/[^`'"]*)/g
const BACKEND_URL_ROUTE = /backend\.url\s*\(\s*[`'"]([^`'"]*)/g
/**
 * `fetch(comfy.backend.url(x))` needs no comparison with the original to be
 * wrong: building the URL through `backend.url` says you meant an API call,
 * and plain `fetch` on it sends no credentials. Found in a file the
 * original-diff heuristic cannot see, because the original used a core widget
 * rather than `fetchApi`.
 */
const UNAUTHED_API_URL = /(?<![.\w])fetch\s*\(\s*comfy\.backend\.url\s*\(/g
/** The same shape in the original: `fetch(api.apiURL(x))`, already unauthenticated. */
const ORIGINAL_UNAUTHED_API_URL = /(?<![.\w])fetch\s*\(\s*api\.apiURL\s*\(/g

/** The leading literal of a route, enough to match one call against another. */
const routes = (text, pattern) =>
  new Set([...text.matchAll(pattern)].map((m) => m[1]).filter(Boolean))
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
const unauthedApiUrl = []
const controlBytes = []
const danglingImports = []

/** `import { a, b } from './x.js'` — the names and the target. */
const NAMED_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g
/** `export function a` / `export const a` / `export { a, b }` / `export class a`. */
const EXPORTED =
  /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)|export\s*\{([^}]*)\}/g

/**
 * Names listed between braces, ignoring comments.
 *
 * Both real packs that tripped this check kept a commented-out entry inside
 * the braces — `//` then a name on the next line — so parsing the raw text
 * either lost the following name or invented one.
 */
function bracedNames(inside) {
  return inside
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .split(',')
    .map(
      (part) =>
        part
          .split(/\s+as\s+/)
          .pop()
          ?.trim() ?? ''
    )
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
}

function exportedNames(text) {
  const names = new Set()
  for (const m of text.matchAll(EXPORTED)) {
    if (m[1]) names.add(m[1])
    for (const name of bracedNames(m[2] ?? '')) names.add(name)
  }
  return names
}

/**
 * Control characters make a file *binary* to grep, so every grep-based gate
 * silently skips it — the conversion looks clean because nothing read it.
 *
 * One conversion wrote a raw NUL as a cache-key separator instead of the
 * escape, and the file went unscanned until `grep` mentioned it in passing.
 */
const controlCount = (text) => {
  let n = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 9 || (code > 13 && code < 32)) n++
  }
  return n
}

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
  // Checked before the converted filter, deliberately: the danger is a file
  // left UNCONVERTED while a neighbour it imports from was punted to
  // `export {}`. Filtering to converted files first hides exactly that.
  // A file importing a name its target no longer exports is a *link* error:
  // it parses, passes every syntax check, and throws when the browser loads
  // it. Punting a module to `export {}` while its neighbours still import
  // from it produces exactly this, and nothing else here can see it.
  for (const [, names, spec] of converted.matchAll(NAMED_IMPORT)) {
    const target = resolve(dirname(dest), spec)
    let targetText
    try {
      targetText = read(target)
    } catch {
      continue
    }
    const available = exportedNames(targetText)
    const missing = names
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .split(',')
      .map((n) => n.split(/\s+as\s+/)[0].trim())
      .filter((n) => /^[A-Za-z_$][\w$]*$/.test(n) && !available.has(n))
    if (missing.length) {
      danglingImports.push({ dest, spec, missing: missing.slice(0, 4) })
    }

    if (!isConverted(converted)) continue

    const wasAuthed = routes(original, AUTHED_ROUTE)
    const stillAuthed = routes(converted, BACKEND_FETCH_ROUTE)
    const nowPlain = routes(converted, PLAIN_FETCH_ROUTE)
    // Downgraded = authenticated before, still called, no longer authenticated.
    const downgraded = [...wasAuthed].filter(
      (r) => nowPlain.has(r) && !stillAuthed.has(r)
    )
    if (downgraded.length) authDropped.push({ dest, downgraded })

    // Only the calls the conversion added: a pack that already fetched an
    // unauthenticated apiURL kept its own bug, which is not ours to report.
    const unauthed =
      count(converted, UNAUTHED_API_URL) -
      count(original, ORIGINAL_UNAUTHED_API_URL)
    if (unauthed > 0) unauthedApiUrl.push({ dest, unauthed })

    const added = controlCount(converted) - controlCount(original)
    if (added > 0) controlBytes.push({ dest, added })
  }

  // Route-aware: the same route the original sent bare must now be going
  // through backend, not merely that the file uses backend somewhere else.
  const nowRouted = new Set([
    ...routes(converted, BACKEND_FETCH_ROUTE),
    ...routes(converted, BACKEND_URL_ROUTE)
  ])
  const prefixed = [
    ...new Set([...original.matchAll(BARE_ROOT_FETCH)].map((m) => m[1]))
  ].filter((r) => nowRouted.has(r))
  if (prefixed.length) routePrefixed.push({ dest, routes: prefixed })
}

function report(title, rows, describe) {
  console.log(`\n${title}: ${rows.length}`)
  for (const row of rows) console.log(`  ${describe(row)}`)
}

report(
  'Authentication dropped (original used api.fetchApi, conversion uses bare fetch)',
  authDropped,
  (r) => `${relative(root, r.dest)}  ${r.downgraded.slice(0, 3).join(' ')}`
)
report(
  'Unauthenticated fetch on a URL built with comfy.backend.url',
  unauthedApiUrl,
  (r) => `${relative(root, r.dest)}  [${r.unauthed} call(s)]`
)
report(
  'Imports a name the target does not export (throws at load, parses fine)',
  danglingImports,
  (r) => `${relative(root, r.dest)} <- ${r.spec}  [${r.missing.join(', ')}]`
)
report(
  'Control characters the original did not have (file is invisible to grep)',
  controlBytes,
  (r) => `${relative(root, r.dest)}  [+${r.added}]`
)
report(
  'Root-relative route may have gained an /api prefix it never had',
  routePrefixed,
  (r) => `${relative(root, r.dest)}  ${r.routes.join(' ')}`
)

// The first two classes are definite regressions. The third depends on whether
// ComfyUI dual-mounts custom node routes, which cannot be settled from here.
process.exit(
  authDropped.length ||
    unauthedApiUrl.length ||
    controlBytes.length ||
    danglingImports.length
    ? 1
    : 0
)
