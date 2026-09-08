import { readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { isNoindexPathname } from '../config/indexing'
import { PARTIAL_LOCALE_ROUTES } from '../config/locales'
import { isLocaleInvariantPath } from '../config/routes'
import { redirects } from '../config/redirects'
import { routeOf } from '../utils/hreflangRoutes'
import type { Alternate } from './hreflang'
import {
  canonicalPath,
  hreflangAlternates,
  ogLocale,
  ogLocaleAlternate,
  sitemapAlternates
} from './hreflang'

const ORIGIN = 'https://comfy.org'

describe('hreflangAlternates', () => {
  it('pairs an English page with its zh-CN twin and x-default', () => {
    expect(hreflangAlternates('/cli/', ORIGIN)).toEqual([
      { hreflang: 'en', href: 'https://comfy.org/cli/' },
      { hreflang: 'zh-CN', href: 'https://comfy.org/zh-CN/cli/' },
      { hreflang: 'x-default', href: 'https://comfy.org/cli/' }
    ])
  })

  it('emits the same set from the zh-CN side', () => {
    expect(hreflangAlternates('/zh-CN/cli/', ORIGIN)).toEqual(
      hreflangAlternates('/cli/', ORIGIN)
    )
  })

  it('handles the home page in every locale that has one', () => {
    // The home page is the one route with all three locales, so it is the only
    // place the full cluster shape can be asserted today.
    const home = hreflangAlternates('/', ORIGIN)
    expect(home).toEqual([
      { hreflang: 'en', href: 'https://comfy.org/' },
      { hreflang: 'zh-CN', href: 'https://comfy.org/zh-CN/' },
      { hreflang: 'ja', href: 'https://comfy.org/ja/' },
      { hreflang: 'x-default', href: 'https://comfy.org/' }
    ])
    expect(hreflangAlternates('/zh-CN/', ORIGIN)).toEqual(home)
    expect(hreflangAlternates('/zh-CN', ORIGIN)).toEqual(home)
  })

  // BE-11285. Previously `/ja/` was read as the English route `/ja`, so it was
  // labelled `en` and its cluster pointed at `/zh-CN/ja/`, which 404s.
  it('labels the Japanese home page ja and clusters it with the others', () => {
    expect(hreflangAlternates('/ja/', ORIGIN)).toEqual(
      hreflangAlternates('/', ORIGIN)
    )
    expect(hreflangAlternates('/ja', ORIGIN)).toEqual(
      hreflangAlternates('/', ORIGIN)
    )
  })

  it('never treats a locale prefix as part of the English path', () => {
    const hrefs = hreflangAlternates('/ja/', ORIGIN).map((a) => a.href)
    expect(hrefs).not.toContain('https://comfy.org/zh-CN/ja/')
    expect(hrefs).not.toContain('https://comfy.org/ja/ja/')
  })

  // Japanese has exactly one page. A blanket rule like Chinese's would
  // advertise a Japanese URL for every route on the site.
  it('offers no ja alternate for routes that have no Japanese page', () => {
    for (const pathname of ['/cli/', '/zh-CN/cli/', '/mcp/']) {
      expect(
        hreflangAlternates(pathname, ORIGIN).map((a) => a.hreflang)
      ).toEqual(['en', 'zh-CN', 'x-default'])
    }
  })

  it('covers dynamic routes that exist in both locales', () => {
    expect(
      hreflangAlternates('/customers/moment-factory/', ORIGIN).map(
        (a) => a.href
      )
    ).toContain('https://comfy.org/zh-CN/customers/moment-factory/')
  })

  it.for([
    '/affiliates/',
    '/affiliates/terms/',
    '/enterprise-msa/',
    '/terms-of-service/',
    '/zh-CN/terms-of-service/',
    '/p/supported-models/',
    '/p/supported-models/flux-1-dev/',
    '/404'
  ])('emits nothing for English-only route %s', (pathname) => {
    expect(hreflangAlternates(pathname, ORIGIN)).toEqual([])
  })
})

describe('sitemapAlternates', () => {
  it('maps alternates to sitemap link entries', () => {
    expect(sitemapAlternates('https://comfy.org/zh-CN/mcp/')).toEqual([
      { url: 'https://comfy.org/mcp/', lang: 'en' },
      { url: 'https://comfy.org/zh-CN/mcp/', lang: 'zh-CN' },
      { url: 'https://comfy.org/mcp/', lang: 'x-default' }
    ])
  })

  it('gives the Japanese home page a cluster with no 404 in it', () => {
    expect(sitemapAlternates('https://comfy.org/ja/')).toEqual([
      { url: 'https://comfy.org/', lang: 'en' },
      { url: 'https://comfy.org/zh-CN/', lang: 'zh-CN' },
      { url: 'https://comfy.org/ja/', lang: 'ja' },
      { url: 'https://comfy.org/', lang: 'x-default' }
    ])
  })

  it('leaves English-only entries without links', () => {
    expect(sitemapAlternates('https://comfy.org/affiliates/')).toBeUndefined()
  })
})

describe('og locale', () => {
  it('uses OG underscored identifiers rather than the BCP 47 tag', () => {
    expect(ogLocale('en')).toBe('en_US')
    expect(ogLocale('zh-CN')).toBe('zh_CN')
    // A locale absent from the map falls back to English, so a Japanese page
    // would declare itself en_US. It shipped that way until this test existed.
    expect(ogLocale('ja')).toBe('ja_JP')
  })

  it('names the other language only when the page has a twin', () => {
    const clustered = hreflangAlternates('/cli/', ORIGIN)
    expect(ogLocaleAlternate('en', clustered)).toBe('zh_CN')
    expect(ogLocaleAlternate('zh-CN', clustered)).toBe('en_US')
    expect(ogLocaleAlternate('en', [])).toBeNull()
  })

  it('pairs a Japanese page with English, not with Chinese', () => {
    // OG takes one alternate. Testing for `zh-CN` rather than `en` sent every
    // localized page to zh_CN, so a Japanese page named a language it has
    // nothing to do with.
    const clustered = hreflangAlternates('/ja/', ORIGIN)
    expect(ogLocaleAlternate('ja', clustered)).toBe('en_US')
  })
})

/**
 * The partial-locale allowlist is hand-maintained, and the page tree is the
 * thing it is meant to describe.
 *
 * What that means changed in P3. The tree used to hold one file per locale, so
 * the check was "does the twin exist". Every localized page is now served from
 * the English one through the i18n fallback, so a localized URL exists exactly
 * when its English page does, and the rot moved with it: the allowlist is now
 * the only thing deciding which localized URLs are linked, indexed and listed
 * in the sitemap, so a wrong entry there is what advertises a URL that 404s.
 *
 * The four tests this replaced all read the tree for locale-named files, and
 * three of them could not fail once those files were gone: two iterated a set
 * that is now always empty, and one filtered the English routes by whether they
 * were absent from the English routes.
 *
 * Static routes only. A dynamic route's `getStaticPaths` can produce any slug
 * set, which the file tree cannot see.
 */
describe('ogLocaleAlternate', () => {
  const alt = (...codes: Alternate['hreflang'][]): Alternate[] =>
    codes.map((hreflang) => ({ hreflang, href: 'https://comfy.org/x/' }))

  it('names the Chinese twin when the page has one', () => {
    expect(ogLocaleAlternate('en', alt('en', 'zh-CN', 'x-default'))).toBe(
      'zh_CN'
    )
  })

  /**
   * An English-only route still carries `en` and `x-default`, so a non-empty
   * cluster was never evidence that a Chinese page exists.
   */
  it('names nothing when the target locale is not published', () => {
    expect(ogLocaleAlternate('en', alt('en', 'x-default'))).toBeNull()
  })

  it('names nothing for a page outside any cluster', () => {
    expect(ogLocaleAlternate('en', [])).toBeNull()
  })

  it('points a localized page back at English', () => {
    expect(ogLocaleAlternate('zh-CN', alt('en', 'zh-CN', 'x-default'))).toBe(
      'en_US'
    )
  })
})

describe('the allowlist agrees with the page tree', () => {
  const pagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'pages')

  const astroFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return astroFiles(full)
      return entry.name.endsWith('.astro') ? [full] : []
    })

  /** `routeOf` trails a slash and the allowlist does not, so one side gives. */
  const withoutTrailingSlash = (route: string) => route.replace(/(.)\/$/, '$1')

  const english = new Set(
    astroFiles(pagesDir)
      .map((file) => relative(pagesDir, file).split(sep).join('/'))
      .filter((rel) => !rel.includes('['))
      .map((rel) => withoutTrailingSlash(routeOf(`/src/pages/${rel}`)))
  )

  const published = Object.entries(PARTIAL_LOCALE_ROUTES).flatMap(
    ([locale, routes]) => [...routes].map((route) => ({ locale, route }))
  )

  it('reads a page tree and an allowlist to check', () => {
    expect(english.size).toBeGreaterThan(50)
    expect(published.length).toBeGreaterThan(0)
  })

  it('backs every published route with an English page', () => {
    const unbacked = published
      .filter(({ route }) => !english.has(route))
      .map(({ locale, route }) => `${locale}: ${route}`)

    expect(
      unbacked,
      'no page exists to serve this locale from, so the URL 404s'
    ).toEqual([])
  })

  /**
   * An entry for a route that is never localized does nothing at all: the
   * redirect wins, the noindex wins, or `localizeHref` refuses to prefix it. The
   * legal documents are all one of the three — the contracts are locale-invariant
   * and the policies are noindexed — so this is also what keeps them out of a
   * localized tree if someone widens the allowlist by hand.
   */
  it('never publishes a route that cannot be localized anyway', () => {
    const redirected = new Set(Object.keys(redirects).map(withoutTrailingSlash))
    const inert = published
      .filter(
        ({ route }) =>
          redirected.has(route) ||
          isNoindexPathname(route) ||
          isLocaleInvariantPath(route)
      )
      .map(({ locale, route }) => `${locale}: ${route}`)

    expect(
      inert,
      'the entry does nothing: the route is redirected, held out of the index, or never localized'
    ).toEqual([])
  })
})

describe('a page whose own locale is held back', () => {
  /**
   * Astro's i18n fallback builds /ja/<route> for every route, but only / is on
   * the Japanese allowlist. Those pages canonical to English, which is right.
   * They were also emitting the English cluster, which is not: nothing in that
   * cluster lists them back, so the site advertised a one-way relationship, and
   * the pages appeared to claim membership of a group they are held out of.
   *
   * A page that is not published in its own locale belongs in no cluster.
   */
  it('emits no alternates for a Japanese page that is not indexable', () => {
    // The English pathname is deliberate: that is what Astro reports during a
    // rewritten fallback render. Only the locale argument reveals it is ja.
    expect(hreflangAlternates('/pricing/', ORIGIN, 'ja')).toEqual([])
  })

  it('still emits them for the Japanese page that IS indexable', () => {
    expect(
      hreflangAlternates('/ja/', ORIGIN, 'ja').map((a) => a.hreflang)
    ).toContain('ja')
  })

  it('leaves Chinese alone, since every Chinese page is published', () => {
    expect(
      hreflangAlternates('/zh-CN/pricing/', ORIGIN, 'zh-CN').map(
        (a) => a.hreflang
      )
    ).toEqual(['en', 'zh-CN', 'x-default'])
  })
})

describe('canonicalPath', () => {
  /**
   * THE most dangerous line in the localization work.
   *
   * Deleting the Chinese page files makes every /zh-CN/ URL a rewritten
   * fallback render, and Astro reports the ENGLISH pathname during those. A
   * canonical built from that pathname told Google the English page was the
   * original for a fully translated Chinese page. Shipped across all 47 files
   * it would have de-indexed the entire Chinese site.
   *
   * The canonical must follow whether the page is PUBLISHED in its locale, not
   * whatever path Astro happens to report.
   */
  it('points a published Chinese page at itself', () => {
    expect(canonicalPath('/pricing/', 'zh-CN')).toBe('/zh-CN/pricing/')
  })

  it('still points a published Chinese page at itself when Astro reports the localized path', () => {
    expect(canonicalPath('/zh-CN/pricing/', 'zh-CN')).toBe('/zh-CN/pricing/')
  })

  it('points a held-back Japanese page at the English original', () => {
    expect(canonicalPath('/pricing/', 'ja')).toBe('/pricing/')
  })

  it('points the published Japanese home page at itself', () => {
    expect(canonicalPath('/ja/', 'ja')).toBe('/ja/')
  })

  it('points a Chinese copy of an English-only route at English', () => {
    expect(canonicalPath('/enterprise/', 'zh-CN')).toBe('/enterprise/')
  })

  it('leaves English alone', () => {
    expect(canonicalPath('/pricing/', 'en')).toBe('/pricing/')
  })
})
