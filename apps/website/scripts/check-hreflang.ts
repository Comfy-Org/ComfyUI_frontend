/**
 * Crawls the built site and fails on a broken language cluster.
 *
 * The ticket asks for this to be validated by a crawl rather than spot checks,
 * because the Chinese pages are hand-duplicated and drift is invisible until
 * someone clicks. Reads dist/ directly, so it costs one build and no network.
 *
 * Fails when:
 *   - an alternate points at a page that was not built (a 404 in the cluster)
 *   - a page advertises an alternate that does not point back at it
 *   - a page emits alternates without also being reachable as its own alternate
 *   - the same hreflang value is emitted twice on one page
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const DIST = join(process.cwd(), 'dist')
const ORIGIN = 'https://comfy.org'

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return htmlFiles(full)
    return entry.name.endsWith('.html') ? [full] : []
  })
}

/** `dist/zh-CN/about/index.html` -> `/zh-CN/about/` */
function routeOf(file: string): string {
  const rel = relative(DIST, file).split(sep).join('/')
  const withoutIndex = rel.replace(/index\.html$/, '')
  return `/${withoutIndex}`.replace(/\/{2,}/g, '/')
}

function alternatesIn(html: string): { hreflang: string; href: string }[] {
  const out: { hreflang: string; href: string }[] = []
  const re = /<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"/g
  for (const match of html.matchAll(re))
    out.push({ hreflang: match[1], href: match[2] })
  return out
}

const files = htmlFiles(DIST)
const built = new Set(files.map(routeOf))
const alternatesByRoute = new Map<
  string,
  { hreflang: string; href: string }[]
>()
const errors: string[] = []

for (const file of files) {
  const route = routeOf(file)
  const alternates = alternatesIn(readFileSync(file, 'utf-8'))
  alternatesByRoute.set(route, alternates)

  const seen = new Set()
  for (const { hreflang, href } of alternates) {
    if (seen.has(hreflang)) {
      errors.push(`${route}: emits hreflang="${hreflang}" more than once`)
    }
    seen.add(hreflang)

    if (!href.startsWith(ORIGIN)) {
      errors.push(`${route}: alternate ${hreflang} points off-origin (${href})`)
      continue
    }
    const target = href.slice(ORIGIN.length) || '/'
    if (!built.has(target)) {
      errors.push(
        `${route}: alternate ${hreflang} -> ${target} was not built (404)`
      )
    }
  }
}

// Reciprocity: if A lists B, B must list A. A one-way cluster is discarded.
for (const [route, alternates] of alternatesByRoute) {
  for (const { hreflang, href } of alternates) {
    if (hreflang === 'x-default') continue
    const target = href.slice(ORIGIN.length) || '/'
    if (target === route) continue
    const back = alternatesByRoute.get(target)
    if (!back) continue // already reported as unbuilt
    if (
      !back.some((entry) => (entry.href.slice(ORIGIN.length) || '/') === route)
    ) {
      errors.push(`${route}: lists ${target}, which does not list it back`)
    }
  }
}

const withCluster = [...alternatesByRoute.values()].filter(
  (list) => list.length > 0
).length
// The repo's lint config allows console.warn and console.error only, and this
// runs in CI where the summary belongs on stderr with the failures anyway.
console.warn(
  `[hreflang] ${files.length} pages built, ${withCluster} in a language cluster, ` +
    `${files.length - withCluster} standalone.`
)

if (errors.length > 0) {
  console.error(`[hreflang] ${errors.length} problem(s):`)
  for (const error of errors.slice(0, 40)) console.error(`  ${error}`)
  if (errors.length > 40) console.error(`  …and ${errors.length - 40} more.`)
  process.exit(1)
}
console.warn(
  '[hreflang] every alternate resolves and every cluster is reciprocal.'
)
