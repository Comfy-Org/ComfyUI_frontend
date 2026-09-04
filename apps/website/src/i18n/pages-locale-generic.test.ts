import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const pagesDir = join(dirname(dirname(fileURLToPath(import.meta.url))), 'pages')

function astroPages(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) astroPages(full, acc)
    else if (entry.endsWith('.astro')) acc.push(full)
  }
  return acc
}

/**
 * `getStaticPaths` is extracted and run before any page renders, so `Astro` does
 * not exist inside it and neither does the locale derived from it. Calls in
 * there must name a locale literally, and that is correct rather than a lapse:
 * a page under `zh-CN/` has Chinese static paths by definition.
 */
function withoutStaticPaths(source: string): string {
  const start = /export\s+(?:async\s+)?function\s+getStaticPaths\s*\(/.exec(
    source
  )
  if (!start) return source

  let index = source.indexOf('{', start.index + start[0].length - 1)
  let depth = 0
  for (; index < source.length; index++) {
    if (source[index] === '{') depth++
    else if (source[index] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  return source.slice(0, start.index) + source.slice(index + 1)
}

/**
 * A page that names a locale can only ever serve that one language, which is why
 * `/ja` had exactly one page while `/zh-CN` had 47 hand-written ones. Every page
 * already computes its own `locale`; using it is what lets one file serve them
 * all.
 */
describe('page files never name a locale', () => {
  const pages = astroPages(pagesDir).map((file) => ({
    name: relative(pagesDir, file),
    body: withoutStaticPaths(readFileSync(file, 'utf8'))
  }))

  it('finds pages to check', () => {
    expect(pages.length).toBeGreaterThan(50)
  })

  it('never passes a literal locale to t()', () => {
    const offenders = pages
      .filter(({ body }) =>
        /\bt\(\s*['"][^'"]+['"]\s*,\s*['"](?:en|zh-CN|ja)['"]\s*\)/.test(body)
      )
      .map(({ name }) => name)

    expect(offenders).toEqual([])
  })

  it('never hands a component a literal locale prop', () => {
    const offenders = pages
      .filter(({ body }) => /\blocale="(?:en|zh-CN|ja)"/.test(body))
      .map(({ name }) => name)

    expect(offenders).toEqual([])
  })

  it('never names a locale when asking for routes or content', () => {
    const offenders = pages
      .filter(({ body }) =>
        /\b(?:getRoutes|loadStories|localizeHref|createBannerVersion)\([^)]*['"](?:en|zh-CN|ja)['"]\s*\)/.test(
          body
        )
      )
      .map(({ name }) => name)

    expect(offenders).toEqual([])
  })
})
