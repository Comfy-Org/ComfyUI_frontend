import { readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { websiteRoot } from '@website/paths'
import { isNoindexPathname } from '@/config/indexing'
import type { Locale } from '@/config/locales'
import { DEFAULT_LOCALE, LOCALE_CODES, LOCALES } from '@/config/locales'
import { astroRedirects } from '@/config/redirects'
import { routeOf } from '@/utils/hreflangRoutes'
import type { Alternate } from './hreflang'
import {
  hreflangAlternates,
  localeAlternates,
  ogLocale,
  ogLocaleAlternates,
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
  it.for(['/cli/', '/zh-CN/cli/', '/mcp/', '/zh-CN/pricing/'])(
    'offers no ja alternate for unpublished route %s',
    (pathname) => {
      expect(
        hreflangAlternates(pathname, ORIGIN).map((a) => a.hreflang)
      ).toEqual(['en', 'zh-CN', 'x-default'])
    }
  )

  it('covers dynamic routes that exist in both locales', () => {
    expect(
      hreflangAlternates('/customers/moment-factory/', ORIGIN).map(
        (a) => a.href
      )
    ).toContain('https://comfy.org/zh-CN/customers/moment-factory/')
  })

  it('keeps file routes without a trailing slash', () => {
    expect(hreflangAlternates('/article.html', ORIGIN)).toEqual([
      { hreflang: 'en', href: 'https://comfy.org/article.html' },
      { hreflang: 'zh-CN', href: 'https://comfy.org/zh-CN/article.html' },
      { hreflang: 'x-default', href: 'https://comfy.org/article.html' }
    ])
  })

  it.for([
    '/affiliates/',
    '/affiliates/terms/',
    '/enterprise-msa/',
    '/terms-of-service/',
    '/privacy-policy/',
    '/zh-CN/privacy-policy/',
    '/booking-confirmation/',
    '/zh-CN/terms-of-service/',
    '/hub/models/local/',
    '/hub/models/local/4x-ultrasharp/',
    '/comfy-agent/',
    '/404'
  ])('emits nothing for %s without indexable translations', (pathname) => {
    expect(hreflangAlternates(pathname, ORIGIN)).toEqual([])
  })

  it('pairs the agent landing page with its zh-CN twin, unlike the still-noindexed /comfy-agent preview', () => {
    expect(hreflangAlternates('/agent/', ORIGIN)).toEqual([
      { hreflang: 'en', href: 'https://comfy.org/agent/' },
      { hreflang: 'zh-CN', href: 'https://comfy.org/zh-CN/agent/' },
      { hreflang: 'x-default', href: 'https://comfy.org/agent/' }
    ])
    expect(hreflangAlternates('/zh-CN/agent/', ORIGIN)).toEqual(
      hreflangAlternates('/agent/', ORIGIN)
    )
  })
})

describe('localeAlternates', () => {
  it('normalizes a locale path without a trailing slash', () => {
    expect(localeAlternates('/zh-CN/cli')).toEqual([
      { locale: 'en', path: '/cli/' },
      { locale: 'zh-CN', path: '/zh-CN/cli/' }
    ])
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

  it.for(['/affiliates/'])(
    'leaves %s without links to unindexable translations',
    (pathname) => {
      expect(sitemapAlternates(`${ORIGIN}${pathname}`)).toBeUndefined()
    }
  )
})

describe('og locale', () => {
  it('uses OG underscored identifiers rather than the BCP 47 tag', () => {
    expect(ogLocale('en')).toBe('en_US')
    expect(ogLocale('zh-CN')).toBe('zh_CN')
    // A locale absent from the map falls back to English, so a Japanese page
    // would declare itself en_US. It shipped that way until this test existed.
    expect(ogLocale('ja')).toBe('ja_JP')
  })

  it('names other languages only when the page has a twin', () => {
    const clustered = hreflangAlternates('/cli/', ORIGIN)
    expect(ogLocaleAlternates('en', clustered)).toEqual(['zh_CN'])
    expect(ogLocaleAlternates('zh-CN', clustered)).toEqual(['en_US'])
    expect(ogLocaleAlternates('en', [])).toEqual([])
  })

  it('names both other published locales on the homepage', () => {
    const clustered = hreflangAlternates('/ja/', ORIGIN)
    expect(ogLocaleAlternates('ja', clustered)).toEqual(['en_US', 'zh_CN'])
    expect(ogLocaleAlternates('en', clustered)).toEqual(['zh_CN', 'ja_JP'])
    expect(ogLocaleAlternates('zh-CN', clustered)).toEqual(['en_US', 'ja_JP'])
  })
})

describe('ogLocaleAlternates', () => {
  function alt(...codes: Alternate['hreflang'][]): Alternate[] {
    return codes.map((hreflang) => ({
      hreflang,
      href: 'https://comfy.org/x/'
    }))
  }

  it('names the Chinese twin when the page has one', () => {
    expect(ogLocaleAlternates('en', alt('en', 'zh-CN', 'x-default'))).toEqual([
      'zh_CN'
    ])
  })

  /**
   * An English-only route still carries `en` and `x-default`, so a non-empty
   * cluster was never evidence that a Chinese page exists.
   */
  it('names nothing when the target locale is not published', () => {
    expect(ogLocaleAlternates('en', alt('en', 'x-default'))).toEqual([])
  })

  it('names nothing for a page outside any cluster', () => {
    expect(ogLocaleAlternates('en', [])).toEqual([])
  })

  it('points a localized page back at English', () => {
    expect(
      ogLocaleAlternates('zh-CN', alt('en', 'zh-CN', 'x-default'))
    ).toEqual(['en_US'])
  })
})

/** Static routes only; dynamic `getStaticPaths` output needs the built-site audit. */
describe('the emitter agrees with the page tree', () => {
  const pagesDir = join(websiteRoot, 'src/pages')

  const astroFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return astroFiles(full)
      return entry.name.endsWith('.astro') && !entry.name.startsWith('_')
        ? [full]
        : []
    })

  const redirected = new Set(
    Object.keys(astroRedirects).map((source) => source.replace(/\/$/, ''))
  )

  const publishedPages = astroFiles(pagesDir)
    .map((file) => relative(pagesDir, file).split(sep).join('/'))
    .filter((file) => !file.includes('['))
    .map((file) => {
      const pathname = routeOf(`/src/pages/${file}`)
      const locale: Locale =
        LOCALE_CODES.find(
          (code) =>
            code !== DEFAULT_LOCALE &&
            pathname.startsWith(`${LOCALES[code].prefix}/`)
        ) ?? DEFAULT_LOCALE
      const unprefixed = pathname.slice(LOCALES[locale].prefix.length) || '/'
      return { locale, pathname, unprefixed }
    })
    .filter(
      ({ pathname, unprefixed }) =>
        unprefixed !== '/404/' && !redirected.has(pathname.replace(/\/$/, ''))
    )
  const indexablePages = publishedPages.filter(
    ({ pathname }) => !isNoindexPathname(pathname)
  )

  function translationsOf(pages: typeof publishedPages, unprefixed: string) {
    const twins = pages.filter((page) => page.unprefixed === unprefixed)
    if (twins.length < 2) return []
    return LOCALE_CODES.flatMap((locale) =>
      twins.filter((page) => page.locale === locale)
    )
  }

  const hreflangCases = indexablePages.map(({ pathname, unprefixed }) => ({
    pathname,
    expected: translationsOf(indexablePages, unprefixed).map((page) => ({
      hreflang: LOCALES[page.locale].hreflang,
      href: new URL(page.pathname, ORIGIN).href
    }))
  }))

  it.for(hreflangCases)(
    'advertises exactly the published locales on $pathname',
    ({ pathname, expected }) => {
      expect(
        hreflangAlternates(pathname, ORIGIN).filter(
          (alternate) => alternate.hreflang !== 'x-default'
        )
      ).toEqual(expected)
    }
  )

  const switcherCases = publishedPages.map(({ pathname, unprefixed }) => ({
    pathname,
    expected: translationsOf(publishedPages, unprefixed).map((page) => ({
      locale: page.locale,
      path: page.pathname
    }))
  }))

  it.for(switcherCases)(
    'offers exactly the published translations of $pathname',
    ({ pathname, expected }) => {
      expect(localeAlternates(pathname)).toEqual(expected)
    }
  )
})
