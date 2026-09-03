import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  findRedirectedLinks,
  internalLinks,
  isLlmsTxtLinkLine,
  normalizePath,
  parseLlmsTxtLinks
} from '../lib/llms-txt'
import { LOCALE_PREFIXES, LOCALIZED_CODES, localePrefix } from './locales'
import { getRoutes } from './routes'

const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const llmsTxt = readFileSync(join(websiteRoot, 'public', 'llms.txt'), 'utf8')
const pagesDir = join(websiteRoot, 'src', 'pages')
const vercelRedirectSources = new Set<string>(
  (
    JSON.parse(readFileSync(join(websiteRoot, 'vercel.json'), 'utf8')) as {
      redirects: { source: string }[]
    }
  ).redirects.map((redirect) => normalizePath(redirect.source))
)

/**
 * Pages that exist in src/pages but are deliberately kept out of llms.txt.
 * Keep the reason next to each entry; remove an entry once the page carries
 * real content so the coverage test starts guarding it.
 */
const EXCLUDED_PAGES = new Set([
  '/404',
  '/agent', // unlisted agent beta waitlist page, noindex
  '/booking-confirmation', // post-form confirmation, no standalone content
  '/individual-submission', // gallery submission form
  '/payment/failed', // checkout return page
  '/payment/success', // checkout return page
  '/case-studies', // "Coming Soon" placeholder
  '/videos', // "Coming Soon" placeholder
  '/demos', // index is a "Coming Soon" placeholder; the demo pages are listed
  '/platform/serverless-animation' // noindex temporary motion study, not a real page
])

/**
 * Files the build emits outside src/pages: the sitemap integration writes
 * sitemap-index.xml, and the markdown-twins integration writes llms-full.txt
 * plus one llms.txt per section (see SECTIONS in
 * src/integrations/markdown-twins.ts). The section indexes live under a real
 * page's directory (e.g. /learning/llms.txt) so the dynamic-route matcher
 * below already accepts them; only the two root-level files need listing.
 */
const BUILD_ARTIFACTS = new Set(['/sitemap-index.xml', '/llms-full.txt'])

/**
 * Route shapes of the Comfy Workflows app, which lives in another repo and is
 * served behind the comfy.org router. Only these shapes may be linked; the
 * slugs themselves are verified against the live site, not here.
 */
const WORKFLOW_APP_ROUTES = [
  /^\/workflows$/,
  /^\/workflows\/creators$/,
  /^\/workflows\/category\/[a-z0-9-]+$/,
  /^\/workflows\/model(\/[a-z0-9-]+)?$/,
  /^\/workflows\/use-cases(\/[a-z0-9-]+)?$/,
  /^\/[a-z]{2}(-[A-Za-z]{2})?\/workflows$/
]

/** Turn `src/pages/learning/[category]/[slug].astro` into a matcher for `/learning/x/y`. */
function pageMatchers(root: string): {
  static: Set<string>
  dynamic: RegExp[]
} {
  const staticPages = new Set<string>()
  const dynamic: RegExp[] = []
  // A locale can be registered in LOCALES before its pages are generated, which
  // is the normal state between adding a language and building its shells. That
  // is not this test's complaint to make: return no routes so the assertions
  // below report the real problem instead of an ENOENT stack.
  if (!existsSync(root)) return { static: staticPages, dynamic }
  const entries = readdirSync(root, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(astro|ts)$/.test(entry.name)) continue
    if (entry.name.endsWith('.test.ts') || entry.name.startsWith('_')) continue
    const relative = join(entry.parentPath, entry.name)
      .slice(root.length)
      .split(sep)
      .join('/')
      .replace(/\.(astro|ts)$/, '')
    // Skip every locale directory, not just Chinese. Naming only /zh-CN/ here
    // meant /ja counted as an English page, which is why the ja launch broke
    // this file's coverage test.
    if (
      root === pagesDir &&
      LOCALE_PREFIXES.some((prefix) => relative.startsWith(`${prefix}/`))
    )
      continue
    const route = relative.replace(/\/index$/, '') || '/'
    if (route.includes('[')) {
      const pattern = route
        .split('/')
        .map((segment) =>
          segment.startsWith('[')
            ? '[^/]+'
            : segment.replace(/[.*+?^${}()|\\]/g, '\\$&')
        )
        .join('/')
      dynamic.push(new RegExp(`^${pattern}$`))
    } else {
      staticPages.add(route)
    }
  }
  return { static: staticPages, dynamic }
}

describe('llms.txt', () => {
  const links = parseLlmsTxtLinks(llmsTxt)
  const internalPaths = internalLinks(links).map(({ path }) => path)
  const { static: staticPages, dynamic } = pageMatchers(pagesDir)
  /** One matcher per localized locale, keyed by its URL prefix. */
  const byLocalePrefix = new Map(
    LOCALIZED_CODES.map((code) => [
      localePrefix(code),
      pageMatchers(join(pagesDir, code))
    ])
  )

  it('follows the llms.txt shape: one H1, a summary blockquote, Optional last', () => {
    const lines = llmsTxt.split('\n')
    expect(lines[0]).toBe('# Comfy')
    expect(lines.filter((line) => line.startsWith('# '))).toHaveLength(1)
    expect(lines.some((line) => line.startsWith('> '))).toBe(true)
    const h2s = lines.filter((line) => line.startsWith('## '))
    expect(h2s.at(-1)).toBe('## Optional')
  })

  it('formats every bullet as "- [title](url): description"', () => {
    const bullets = llmsTxt.split('\n').filter((line) => line.startsWith('- ['))
    const malformed = bullets.filter((line) => !isLlmsTxtLinkLine(line))
    expect(malformed).toEqual([])
    expect(links.length).toBeGreaterThan(100)
  })

  it('lists each URL once', () => {
    const seen = new Map<string, number>()
    for (const { url } of links) seen.set(url, (seen.get(url) ?? 0) + 1)
    const duplicates = [...seen]
      .filter(([, count]) => count > 1)
      .map(([url]) => url)
    expect(duplicates).toEqual([])
  })

  it('only links comfy.org paths that this site (or the workflows app) serves', () => {
    const unknown = internalPaths.filter((path) => {
      if (BUILD_ARTIFACTS.has(path)) return false
      if (path.includes('/workflows')) {
        return !WORKFLOW_APP_ROUTES.some((route) => route.test(path))
      }
      const prefix = LOCALE_PREFIXES.find(
        (candidate) => path === candidate || path.startsWith(`${candidate}/`)
      )
      if (prefix !== undefined) {
        const matchers = byLocalePrefix.get(prefix)
        if (matchers === undefined) return true
        const base = normalizePath(path.slice(prefix.length))
        return (
          !matchers.static.has(base) &&
          !matchers.dynamic.some((matcher) => matcher.test(base))
        )
      }
      return (
        !staticPages.has(path) && !dynamic.some((matcher) => matcher.test(path))
      )
    })
    expect(unknown).toEqual([])
  })

  it('covers every static page in src/pages', () => {
    const linked = new Set(internalPaths)
    const missing = [...staticPages]
      .filter((page) => !EXCLUDED_PAGES.has(page) && !linked.has(page))
      .sort()
    expect(missing).toEqual([])
  })

  it('covers every route in routes.ts', () => {
    const linked = new Set(internalPaths)
    const missing = Object.values(getRoutes('en'))
      .map(normalizePath)
      .filter((route) => !EXCLUDED_PAGES.has(route) && !linked.has(route))
    expect(missing).toEqual([])
  })

  it('does not list excluded pages by accident', () => {
    const linked = new Set(internalPaths)
    const listedButExcluded = [...EXCLUDED_PAGES].filter((page) =>
      linked.has(page)
    )
    expect(listedButExcluded).toEqual([])
  })

  it('uses only literal redirect sources for stale link checks', () => {
    const patternedSources = [...vercelRedirectSources].filter((source) =>
      /[:*(]/.test(source)
    )
    expect(patternedSources).toEqual([])
  })

  it('links a redirect destination rather than its stale source', () => {
    const redirected = findRedirectedLinks(links, vercelRedirectSources)
    expect(redirected).toEqual([])
  })
})
