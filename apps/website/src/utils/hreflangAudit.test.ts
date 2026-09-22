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

function canonicalsFor(pages: ReadonlyMap<string, Alternate[]>) {
  return new Map<string, string>(
    [...pages.keys()].map((route): [string, string] => [
      route,
      `${ORIGIN}${route}`
    ])
  )
}

/** A built site with one clustered page pair and one English-only page. */
function healthySite() {
  const pages = new Map<string, Alternate[]>([
    ['/about/', cluster('/about/')],
    ['/zh-CN/about/', cluster('/about/')],
    ['/affiliates/', []]
  ])
  return {
    origin: ORIGIN,
    pages,
    canonicals: canonicalsFor(pages),
    sitemap: new Map(pages)
  }
}

function encodedSite() {
  const alternates: Alternate[] = [
    { hreflang: 'en', href: 'https://comfy.org/caf%C3%A9/' },
    { hreflang: 'zh-CN', href: 'https://comfy.org/zh-CN/caf%C3%A9/' },
    { hreflang: 'x-default', href: 'https://comfy.org/caf%C3%A9/' }
  ]
  const pages = new Map<string, Alternate[]>([
    ['/café/', alternates],
    ['/zh-CN/café/', alternates]
  ])
  return {
    origin: ORIGIN,
    pages,
    canonicals: new Map([
      ['/café/', 'https://comfy.org/caf%C3%A9/'],
      ['/zh-CN/café/', 'https://comfy.org/zh-CN/caf%C3%A9/']
    ]),
    sitemap: new Map(pages)
  }
}

describe('auditBuiltSite', () => {
  it('passes a healthy cluster and leaves a page with no twin alone', () => {
    expect(auditBuiltSite(healthySite())).toEqual([])
  })

  it('rejects a translated page and sitemap that omit every alternate', () => {
    const pages = new Map<string, Alternate[]>([
      ['/about/', []],
      ['/affiliates/', []]
    ])
    const errors = auditBuiltSite({
      origin: ORIGIN,
      pages,
      canonicals: canonicalsFor(pages),
      sitemap: new Map(pages)
    })

    expect(errors).toHaveLength(6)
    expect(errors).toEqual(
      expect.arrayContaining([
        '/about/: page expects en -> https://comfy.org/about/, but does not declare it',
        '/about/: page expects zh-CN -> https://comfy.org/zh-CN/about/, but does not declare it',
        '/about/: page expects x-default -> https://comfy.org/about/, but does not declare it',
        '/about/: sitemap expects en -> https://comfy.org/about/, but does not declare it',
        '/about/: sitemap expects zh-CN -> https://comfy.org/zh-CN/about/, but does not declare it',
        '/about/: sitemap expects x-default -> https://comfy.org/about/, but does not declare it'
      ])
    )
  })

  it('rejects an omitted sitemap entry even when the page has no alternates', () => {
    const pages = new Map<string, Alternate[]>([['/about/', []]])

    expect(
      auditBuiltSite({
        origin: ORIGIN,
        pages,
        canonicals: canonicalsFor(pages),
        sitemap: new Map()
      })
    ).toEqual([
      '/about/: page expects en -> https://comfy.org/about/, but does not declare it',
      '/about/: page expects zh-CN -> https://comfy.org/zh-CN/about/, but does not declare it',
      '/about/: page expects x-default -> https://comfy.org/about/, but does not declare it',
      '/about/: language cluster missing from sitemap'
    ])
  })

  it.for([
    '/404.html',
    '/affiliates/',
    '/privacy-policy/',
    '/cloud/enterprise/'
  ])('allows an empty cluster on standalone route %s', (route) => {
    expect(
      auditBuiltSite({
        origin: ORIGIN,
        pages: new Map<string, Alternate[]>([[route, []]]),
        canonicals: new Map(),
        sitemap: new Map()
      })
    ).toEqual([])
  })

  it('still rejects an unlisted HTML page with no cluster', () => {
    const pages = new Map<string, Alternate[]>([['/article.html', []]])

    expect(
      auditBuiltSite({
        origin: ORIGIN,
        pages,
        canonicals: new Map(),
        sitemap: new Map()
      })
    ).toEqual([
      '/article.html: canonical must be https://comfy.org/article.html',
      '/article.html: page expects en -> https://comfy.org/article.html, but does not declare it',
      '/article.html: page expects zh-CN -> https://comfy.org/zh-CN/article.html, but does not declare it',
      '/article.html: page expects x-default -> https://comfy.org/article.html, but does not declare it',
      '/article.html: language cluster missing from sitemap'
    ])
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
    site.sitemap.delete('/zh-CN/about/')

    expect(auditBuiltSite(site)).toEqual([
      '/zh-CN/about/: language cluster missing from sitemap'
    ])
  })

  it('rejects an alternate pointing at a page that was not built', () => {
    const site = healthySite()
    site.pages.set('/about/', cluster('/about/'))
    site.pages.delete('/zh-CN/about/')
    site.sitemap.delete('/zh-CN/about/')

    expect(auditBuiltSite(site)).toEqual([
      '/about/: alternate zh-CN -> /zh-CN/about/ was not built (404)'
    ])
  })

  it('rejects a required locale omitted from the build and both clusters', () => {
    const site = healthySite()
    site.pages.delete('/zh-CN/about/')
    site.sitemap.delete('/zh-CN/about/')
    const english = cluster('/about/').filter(
      ({ hreflang }) => hreflang !== 'zh-CN'
    )
    site.pages.set('/about/', english)
    site.sitemap.set('/about/', english)

    expect(auditBuiltSite(site)).toEqual([
      '/about/: page expects zh-CN -> https://comfy.org/zh-CN/about/, but does not declare it',
      '/about/: sitemap expects zh-CN -> https://comfy.org/zh-CN/about/, but does not declare it'
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
    site.sitemap.set('/zh-CN/about/', [])

    expect(auditBuiltSite(site)).toEqual([
      '/zh-CN/about/: page expects en -> https://comfy.org/about/, but does not declare it',
      '/zh-CN/about/: page expects zh-CN -> https://comfy.org/zh-CN/about/, but does not declare it',
      '/zh-CN/about/: page expects x-default -> https://comfy.org/about/, but does not declare it',
      '/about/: lists /zh-CN/about/, which does not list it back',
      '/zh-CN/about/: sitemap expects en -> https://comfy.org/about/, but does not declare it',
      '/zh-CN/about/: sitemap expects zh-CN -> https://comfy.org/zh-CN/about/, but does not declare it',
      '/zh-CN/about/: sitemap expects x-default -> https://comfy.org/about/, but does not declare it'
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
    site.sitemap.set('/affiliates/', cluster('/affiliates/'))

    expect(auditBuiltSite(site)).toEqual([
      '/affiliates/: sitemap advertises en, zh-CN, x-default that the page does not'
    ])
  })

  it('rejects a sitemap entry whose zh-CN link points at the English URL', () => {
    // The language SET still matches the page exactly, so comparing names alone
    // accepts this. It tells Google the English URL is the Chinese one.
    const site = healthySite()
    site.sitemap.set('/about/', [
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
    site.sitemap.set('/about/', [
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
    site.sitemap.set('/about/', [...cluster('/about/'), ja])

    expect(auditBuiltSite(site)).toEqual([
      '/about/: page declares hreflang="ja", which is not one of en, zh-CN, x-default',
      '/about/: sitemap declares hreflang="ja", which is not one of en, zh-CN, x-default'
    ])
  })

  it('reports a sitemap URL with no page behind it', () => {
    const site = healthySite()
    site.sitemap.set('/retired/', [])

    expect(auditBuiltSite(site)).toEqual([
      '/retired/: the sitemap lists it, but it was not built (404)'
    ])
  })

  it('reports a page advertising a locale the sitemap does not', () => {
    // The other direction of the same drift: the sitemap dropping x-default
    // while the pages keep emitting it.
    const site = healthySite()
    site.sitemap.set('/about/', cluster('/about/').slice(0, 2))

    expect(auditBuiltSite(site)).toEqual([
      '/about/: sitemap expects x-default -> https://comfy.org/about/, but does not declare it',
      '/about/: page advertises x-default that the sitemap does not'
    ])
  })
})

describe('canonical URLs', () => {
  it('requires a canonical when an indexable page omits every alternate', () => {
    const pages = new Map<string, Alternate[]>([['/about/', []]])

    expect(
      auditBuiltSite({
        origin: ORIGIN,
        pages,
        canonicals: new Map(),
        sitemap: new Map(pages)
      })
    ).toEqual([
      '/about/: canonical must be https://comfy.org/about/',
      '/about/: page expects en -> https://comfy.org/about/, but does not declare it',
      '/about/: page expects zh-CN -> https://comfy.org/zh-CN/about/, but does not declare it',
      '/about/: page expects x-default -> https://comfy.org/about/, but does not declare it',
      '/about/: sitemap expects en -> https://comfy.org/about/, but does not declare it',
      '/about/: sitemap expects zh-CN -> https://comfy.org/zh-CN/about/, but does not declare it',
      '/about/: sitemap expects x-default -> https://comfy.org/about/, but does not declare it'
    ])
  })

  it.for([
    {
      name: 'another origin',
      canonical: 'https://other.example/zh-CN/about/'
    },
    {
      name: 'query string',
      canonical: 'https://comfy.org/zh-CN/about/?preview=true'
    },
    {
      name: 'fragment',
      canonical: 'https://comfy.org/zh-CN/about/#section'
    }
  ])('rejects $name on a clustered page', ({ canonical }) => {
    const site = healthySite()
    site.canonicals.set('/zh-CN/about/', canonical)

    expect(auditBuiltSite(site)).toEqual([
      '/zh-CN/about/: canonical must be https://comfy.org/zh-CN/about/'
    ])
  })

  it('rejects a missing canonical link on a clustered page', () => {
    const site = healthySite()
    site.canonicals.delete('/zh-CN/about/')

    expect(auditBuiltSite(site)).toEqual([
      '/zh-CN/about/: canonical must be https://comfy.org/zh-CN/about/'
    ])
  })

  it('checks the full canonical URL on the root route', () => {
    const alternates = [
      ...cluster('/'),
      { hreflang: 'ja', href: 'https://comfy.org/ja/' }
    ]
    const pages = new Map<string, Alternate[]>([
      ['/', alternates],
      ['/zh-CN/', alternates],
      ['/ja/', alternates]
    ])
    const canonicals = canonicalsFor(pages)
    canonicals.set('/', 'https://other.example/')

    expect(
      auditBuiltSite({
        origin: ORIGIN,
        pages,
        canonicals,
        sitemap: new Map(pages)
      })
    ).toEqual(['/: canonical must be https://comfy.org/'])
  })

  it('accepts percent-encoded canonicals and alternates for raw non-ASCII routes', () => {
    expect(auditBuiltSite(encodedSite())).toEqual([])
  })

  it('rejects an encoded alternate pointing at the wrong locale', () => {
    const site = encodedSite()
    site.pages.set('/café/', [
      { hreflang: 'en', href: 'https://comfy.org/caf%C3%A9/' },
      { hreflang: 'zh-CN', href: 'https://comfy.org/caf%C3%A9/' },
      { hreflang: 'x-default', href: 'https://comfy.org/caf%C3%A9/' }
    ])

    expect(auditBuiltSite(site)).toContain(
      '/café/: page expects zh-CN -> https://comfy.org/zh-CN/caf%C3%A9/, but does not declare it'
    )
  })

  it('does not require a canonical URL for a standalone page', () => {
    const site = healthySite()
    site.canonicals.delete('/affiliates/')

    expect(auditBuiltSite(site)).toEqual([])
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

describe('Japanese publication', () => {
  it('requires a built Japanese page in the page and sitemap clusters', () => {
    const site = healthySite()
    site.pages.set('/ja/about/', [])
    site.canonicals.set('/ja/about/', `${ORIGIN}/ja/about/`)

    const errors = auditBuiltSite(site)
    expect(errors).toHaveLength(9)
    expect(errors).toEqual(
      expect.arrayContaining([
        '/about/: page expects ja -> https://comfy.org/ja/about/, but does not declare it',
        '/zh-CN/about/: page expects ja -> https://comfy.org/ja/about/, but does not declare it',
        '/ja/about/: page expects en -> https://comfy.org/about/, but does not declare it',
        '/ja/about/: page expects zh-CN -> https://comfy.org/zh-CN/about/, but does not declare it',
        '/ja/about/: page expects ja -> https://comfy.org/ja/about/, but does not declare it',
        '/ja/about/: page expects x-default -> https://comfy.org/about/, but does not declare it',
        '/ja/about/: language cluster missing from sitemap',
        '/about/: sitemap expects ja -> https://comfy.org/ja/about/, but does not declare it',
        '/zh-CN/about/: sitemap expects ja -> https://comfy.org/ja/about/, but does not declare it'
      ])
    )
  })

  it.for(['/', '/about/'])('accepts a published Japanese route %s', (path) => {
    const alternates = [
      ...cluster(path),
      { hreflang: 'ja', href: `${ORIGIN}/ja${path}` }
    ]
    const pages = new Map([
      [path, alternates],
      [`/zh-CN${path}`, alternates],
      [`/ja${path}`, alternates]
    ])

    expect(
      auditBuiltSite({
        origin: ORIGIN,
        pages,
        canonicals: canonicalsFor(pages),
        sitemap: new Map(pages)
      })
    ).toEqual([])
  })
})
