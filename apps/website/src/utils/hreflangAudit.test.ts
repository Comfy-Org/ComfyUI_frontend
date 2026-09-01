import { describe, expect, it } from 'vitest'

import type { Alternate } from './hreflangRoutes'

import { auditBuiltSite, sitemapChunkNames } from './hreflangAudit'

const ORIGIN = 'https://comfy.org'

/** The alternates a healthy cluster emits, identical on both twins. */
function cluster(path: string): Alternate[] {
  return [
    { hreflang: 'en', href: `${ORIGIN}${path}` },
    { hreflang: 'zh-CN', href: `${ORIGIN}/zh-CN${path}` },
    { hreflang: 'x-default', href: `${ORIGIN}${path}` }
  ]
}

/** A built site with one clustered page pair and one English-only page. */
function healthySite() {
  return {
    origin: ORIGIN,
    pages: new Map<string, Alternate[]>([
      ['/about/', cluster('/about/')],
      ['/zh-CN/about/', cluster('/about/')],
      ['/affiliates/', []]
    ]),
    sitemap: new Map<string, Alternate[]>([
      ['/about/', cluster('/about/')],
      ['/zh-CN/about/', cluster('/about/')],
      ['/affiliates/', []]
    ])
  }
}

describe('auditBuiltSite', () => {
  it('passes a healthy cluster and leaves a page with no twin alone', () => {
    expect(auditBuiltSite(healthySite())).toEqual([])
  })

  it('rejects a cluster whose two locales are swapped', () => {
    // Every link still resolves and each page lists the other, so reciprocity
    // is satisfied; only the labels are wrong. Google would be told the English
    // page is the Chinese one.
    const site = healthySite()
    site.pages.set('/about/', [
      { hreflang: 'en', href: `${ORIGIN}/zh-CN/about/` },
      { hreflang: 'zh-CN', href: `${ORIGIN}/about/` },
      { hreflang: 'x-default', href: `${ORIGIN}/about/` }
    ])

    expect(auditBuiltSite(site)).toEqual([
      '/about/: page expects en -> https://comfy.org/about/, but does not declare it',
      '/about/: page expects zh-CN -> https://comfy.org/zh-CN/about/, but does not declare it'
    ])
  })

  it('rejects a clustered page the sitemap leaves out', () => {
    const site = healthySite()
    site.sitemap?.delete('/zh-CN/about/')

    expect(auditBuiltSite(site)).toEqual([
      '/zh-CN/about/: advertises alternates but the sitemap omits it'
    ])
  })

  it('rejects an alternate pointing at a page that was not built', () => {
    const site = healthySite()
    site.pages.set('/about/', cluster('/about/'))
    site.pages.delete('/zh-CN/about/')
    site.sitemap?.delete('/zh-CN/about/')

    expect(auditBuiltSite(site)).toEqual([
      '/about/: alternate zh-CN -> /zh-CN/about/ was not built (404)'
    ])
  })

  it('rejects the same hreflang emitted twice on one page', () => {
    const site = healthySite()
    site.pages.set('/about/', [
      ...cluster('/about/'),
      { hreflang: 'en', href: `${ORIGIN}/about/` }
    ])

    expect(auditBuiltSite(site)).toEqual([
      '/about/: page declares hreflang="en" more than once'
    ])
  })

  it('rejects a one-way cluster', () => {
    const site = healthySite()
    site.pages.set('/zh-CN/about/', [])
    site.sitemap?.set('/zh-CN/about/', [])

    expect(auditBuiltSite(site)).toEqual([
      '/about/: lists /zh-CN/about/, which does not list it back'
    ])
  })

  it('rejects an alternate on another origin', () => {
    const site = healthySite()
    site.pages.set('/about/', [
      { hreflang: 'en', href: `${ORIGIN}/about/` },
      { hreflang: 'zh-CN', href: 'https://www.comfy.org/zh-CN/about/' },
      { hreflang: 'x-default', href: `${ORIGIN}/about/` }
    ])

    expect(auditBuiltSite(site)).toEqual([
      '/about/: page alternate zh-CN points off-origin (https://www.comfy.org/zh-CN/about/)',
      '/about/: page expects zh-CN -> https://comfy.org/zh-CN/about/, but does not declare it',
      // The twin still points here, so losing the link back breaks reciprocity
      // too. Asserting the exact list is what makes that visible.
      '/zh-CN/about/: lists /about/, which does not list it back'
    ])
  })

  it('reports a missing sitemap rather than silently skipping it', () => {
    expect(auditBuiltSite({ ...healthySite(), sitemap: null })).toEqual([
      'sitemap-0.xml is missing, so its alternates cannot be checked'
    ])
  })

  it('reports a sitemap advertising a locale the page does not', () => {
    // The sitemap clusters a page whose markup advertises nothing. Both halves
    // are internally well-formed, so only comparing them catches it.
    const site = healthySite()
    site.sitemap?.set('/affiliates/', cluster('/affiliates/'))

    expect(auditBuiltSite(site)).toEqual([
      '/affiliates/: sitemap advertises en, zh-CN, x-default that the page does not'
    ])
  })

  it('rejects a sitemap entry whose zh-CN link points at the English URL', () => {
    // The language SET still matches the page exactly, so comparing names alone
    // accepts this. It tells Google the English URL is the Chinese one.
    const site = healthySite()
    site.sitemap?.set('/about/', [
      { hreflang: 'en', href: `${ORIGIN}/about/` },
      { hreflang: 'zh-CN', href: `${ORIGIN}/about/` },
      { hreflang: 'x-default', href: `${ORIGIN}/about/` }
    ])

    expect(auditBuiltSite(site)).toEqual([
      '/about/: sitemap expects zh-CN -> https://comfy.org/zh-CN/about/, but does not declare it'
    ])
  })

  it('rejects a language repeated inside one sitemap entry', () => {
    const site = healthySite()
    site.sitemap?.set('/about/', [
      ...cluster('/about/'),
      { hreflang: 'en', href: `${ORIGIN}/about/` }
    ])

    expect(auditBuiltSite(site)).toEqual([
      '/about/: sitemap declares hreflang="en" more than once'
    ])
  })

  it('rejects a locale outside the supported cluster on both sources', () => {
    // Declared identically in the markup and the sitemap, so the two-source
    // comparison sees no disagreement, and pointed at a page that does exist,
    // so neither the built check nor reciprocity fires. Nothing else can see it.
    const site = healthySite()
    const ja = { hreflang: 'ja', href: `${ORIGIN}/zh-CN/about/` }
    site.pages.set('/about/', [...cluster('/about/'), ja])
    site.sitemap?.set('/about/', [...cluster('/about/'), ja])

    expect(auditBuiltSite(site)).toEqual([
      '/about/: page declares hreflang="ja", which is not one of en, zh-CN, x-default',
      '/about/: sitemap declares hreflang="ja", which is not one of en, zh-CN, x-default'
    ])
  })

  it('reports a sitemap URL with no page behind it', () => {
    const site = healthySite()
    site.sitemap?.set('/retired/', [])

    expect(auditBuiltSite(site)).toEqual([
      '/retired/: the sitemap lists it, but it was not built (404)'
    ])
  })

  it('reports a page advertising a locale the sitemap does not', () => {
    // The other direction of the same drift: the sitemap dropping x-default
    // while the pages keep emitting it.
    const site = healthySite()
    site.sitemap?.set('/about/', cluster('/about/').slice(0, 2))

    expect(auditBuiltSite(site)).toEqual([
      '/about/: sitemap expects x-default -> https://comfy.org/about/, but does not declare it',
      '/about/: page advertises x-default that the sitemap does not'
    ])
  })
})

describe('sitemapChunkNames', () => {
  const index = (locs: string[]) =>
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex>${locs
      .map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`)
      .join('')}</sitemapindex>`

  it('returns every chunk the index names', () => {
    expect(
      sitemapChunkNames(
        index([
          'https://comfy.org/sitemap-0.xml',
          'https://comfy.org/sitemap-1.xml',
          'https://comfy.org/sitemap-2.xml'
        ])
      )
    ).toEqual(['sitemap-0.xml', 'sitemap-1.xml', 'sitemap-2.xml'])
  })

  it('ignores sitemaps another app builds', () => {
    // The published index also lists the hub's sitemap. It is not in this dist,
    // so counting it would report every hub URL as a page we failed to build.
    expect(
      sitemapChunkNames(
        index([
          'https://comfy.org/sitemap-0.xml',
          'https://comfy.org/sitemap-workflows-0.xml'
        ])
      )
    ).toEqual(['sitemap-0.xml'])
  })

  it('returns nothing for an empty or unparseable index', () => {
    expect(sitemapChunkNames('')).toEqual([])
    expect(sitemapChunkNames('<sitemapindex></sitemapindex>')).toEqual([])
  })
})
