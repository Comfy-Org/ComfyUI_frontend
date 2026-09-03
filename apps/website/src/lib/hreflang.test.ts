import { readdirSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { isNoindexPathname } from '../config/indexing'
import { redirects } from '../config/redirects'
import {
  JA_HREFLANG,
  JA_PREFIX,
  routeOf,
  ZH_PREFIX
} from '../utils/hreflangRoutes'
import {
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
 * `isLocaleInvariantPath` is a hand-maintained list, and the page tree is the
 * thing it is meant to describe. Reading the tree back catches the entry nobody
 * added: an English page whose Chinese twin does not exist still advertises one,
 * which is a cluster pointing at a 404.
 *
 * Static routes only. A dynamic route's two `getStaticPaths` are free to produce
 * different slug sets, which the file tree cannot see.
 */
describe('the emitter agrees with the page tree', () => {
  const pagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'pages')

  const astroFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return astroFiles(full)
      return entry.name.endsWith('.astro') ? [full] : []
    })

  const english = new Set<string>()
  const chinese = new Set<string>()
  const japanese = new Set<string>()
  for (const file of astroFiles(pagesDir)) {
    const rel = relative(pagesDir, file).split(sep).join('/')
    if (rel.includes('[')) continue
    const route = routeOf(`/src/pages/${rel}`)
    if (route.startsWith(`${ZH_PREFIX}/`)) {
      chinese.add(route.slice(ZH_PREFIX.length) || '/')
    } else if (route.startsWith(`${JA_PREFIX}/`)) {
      japanese.add(route.slice(JA_PREFIX.length) || '/')
    } else {
      english.add(route)
    }
  }

  const redirected = new Set(
    Object.keys(redirects).map((source) => source.replace(/\/$/, ''))
  )

  /** What `BaseLayout` ends up emitting for a route that was actually built. */
  const clusters = (pathname: string): boolean =>
    !redirected.has(pathname.replace(/\/$/, '')) &&
    !isNoindexPathname(pathname) &&
    hreflangAlternates(pathname, ORIGIN).length > 0

  it('never advertises a zh-CN page that does not exist', () => {
    const lying = [...english].filter(
      (route) => clusters(route) && !chinese.has(route)
    )
    expect(
      lying,
      'add a zh-CN page or mark the route locale-invariant'
    ).toEqual([])
  })

  it('never advertises an English page that does not exist', () => {
    const lying = [...chinese].filter(
      (route) => clusters(`${ZH_PREFIX}${route}`) && !english.has(route)
    )
    expect(lying, 'the English twin was moved or removed').toEqual([])
  })

  const advertisesJa = (route: string): boolean =>
    hreflangAlternates(route, ORIGIN).some(
      (alternate) => alternate.hreflang === JA_HREFLANG
    )

  /**
   * The two directions `JA_ROUTES` can rot in. Chinese needs neither check
   * because it has a blanket rule; Japanese is an explicit list, so both the
   * list claiming too much and the list claiming too little have to be caught.
   */
  it('never advertises a ja page that does not exist', () => {
    const lying = [...english].filter(
      (route) => advertisesJa(route) && !japanese.has(route)
    )
    expect(
      lying,
      'add the Japanese page or drop the route from JA_ROUTES'
    ).toEqual([])
  })

  it('clusters every Japanese page that was built', () => {
    const unlisted = [...japanese].filter(
      (route) => clusters(route) && !advertisesJa(route)
    )
    expect(unlisted, 'add the route to JA_ROUTES in hreflang.ts').toEqual([])
  })
})
