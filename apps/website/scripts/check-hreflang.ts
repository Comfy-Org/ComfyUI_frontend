/**
 * Crawls the built site and fails on a broken language cluster.
 *
 * The ticket asks for this to be validated by a crawl rather than spot checks,
 * because the Chinese pages are hand-duplicated and drift is invisible until
 * someone clicks. Reads dist/ directly, so it costs one build and no network.
 *
 * This file only gathers what was built; `hreflangAudit.ts` holds the rules, so
 * they can be tested against fixtures rather than a full build.
 */
import type { Alternate } from '../src/utils/hreflangRoutes'

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { auditBuiltSite, sitemapChunkNames } from '../src/utils/hreflangAudit'

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

function alternatesIn(html: string): Alternate[] {
  const out: Alternate[] = []
  const re = /<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"/g
  for (const match of html.matchAll(re))
    out.push({ hreflang: match[1], href: match[2] })
  return out
}

/** Every sitemap chunk in this build, via the index so later chunks are not missed. */
function sitemapFiles(): string[] {
  const indexPath = join(DIST, 'sitemap-index.xml')
  if (existsSync(indexPath)) {
    const names = sitemapChunkNames(readFileSync(indexPath, 'utf-8'))
    // Dropping a named-but-absent chunk would let the gate quietly audit less
    // than it was asked to and still exit 0, and dropping all of them would fall
    // through to the single-file path below and audit one chunk of many.
    const missing = names.filter((name) => !existsSync(join(DIST, name)))
    if (missing.length > 0) {
      throw new Error(
        `[hreflang] sitemap index names chunk(s) that were not built: ${missing.join(', ')}`
      )
    }
    if (names.length) return names.map((name) => join(DIST, name))
  }
  const single = join(DIST, 'sitemap-0.xml')
  return existsSync(single) ? [single] : []
}

function sitemapAlternates(): Map<string, Alternate[]> | null {
  const files = sitemapFiles()
  if (!files.length) return null

  const entries = new Map<string, Alternate[]>()
  const xml = files.map((file) => readFileSync(file, 'utf-8')).join('')
  for (const entry of xml.matchAll(/<url>(.*?)<\/url>/gs)) {
    const block = entry[1]
    const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1]
    if (!loc?.startsWith(ORIGIN)) continue
    // Kept as a list, not a set: a language repeated in one entry is itself a
    // defect, and collapsing it here would hide it from the audit.
    const alternates = [
      ...block.matchAll(/hreflang="([^"]+)"\s+href="([^"]+)"/g)
    ].map((match) => ({ hreflang: match[1], href: match[2] }))
    entries.set(loc.slice(ORIGIN.length) || '/', alternates)
  }
  return entries
}

const files = htmlFiles(DIST)
const pages = new Map<string, Alternate[]>(
  files.map((file) => [
    routeOf(file),
    alternatesIn(readFileSync(file, 'utf-8'))
  ])
)
const sitemap = sitemapAlternates()
const errors = auditBuiltSite({ pages, sitemap, origin: ORIGIN })

const withCluster = [...pages.values()].filter((list) => list.length > 0).length
// The repo's lint config allows console.warn and console.error only, and this
// runs in CI where the summary belongs on stderr with the failures anyway.
console.warn(
  `[hreflang] ${files.length} pages built, ${withCluster} in a language cluster, ` +
    `${files.length - withCluster} standalone, ` +
    `${[...(sitemap?.values() ?? [])].filter((list) => list.length > 0).length} sitemap entries with alternates.`
)

if (errors.length > 0) {
  console.error(`[hreflang] ${errors.length} problem(s):`)
  for (const error of errors.slice(0, 40)) console.error(`  ${error}`)
  if (errors.length > 40) console.error(`  …and ${errors.length - 40} more.`)
  process.exit(1)
}
console.warn(
  '[hreflang] every alternate resolves, every cluster is reciprocal, and every ' +
    'locale points where it claims.'
)
