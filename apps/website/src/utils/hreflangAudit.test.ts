import { describe, expect, it } from 'vitest'

import type { Alternate } from './hreflang'

import { auditBuiltSite } from './hreflangAudit'

const ORIGIN = 'https://comfy.org'

/** The alternates a healthy cluster emits, identical on both twins. */
function cluster(path: string): Alternate[] {
  return [
    { hreflang: 'en', href: `${ORIGIN}${path}` },
    { hreflang: 'zh-Hans', href: `${ORIGIN}/zh-CN${path}` },
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
    sitemap: new Map<string, Set<string>>([
      ['/about/', new Set(['en', 'zh-Hans', 'x-default'])],
      ['/zh-CN/about/', new Set(['en', 'zh-Hans', 'x-default'])],
      ['/affiliates/', new Set()]
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
      { hreflang: 'zh-Hans', href: `${ORIGIN}/about/` },
      { hreflang: 'x-default', href: `${ORIGIN}/about/` }
    ])

    expect(auditBuiltSite(site)).toContain(
      '/about/: expects en -> https://comfy.org/about/, but does not emit it'
    )
  })

  it('rejects a clustered page the sitemap leaves out', () => {
    const site = healthySite()
    site.sitemap?.delete('/zh-CN/about/')

    expect(auditBuiltSite(site)).toContain(
      '/zh-CN/about/: advertises alternates but the sitemap omits it'
    )
  })

  it('rejects an alternate pointing at a page that was not built', () => {
    const site = healthySite()
    site.pages.set('/about/', cluster('/about/'))
    site.pages.delete('/zh-CN/about/')
    site.sitemap?.delete('/zh-CN/about/')

    expect(auditBuiltSite(site)).toContain(
      '/about/: alternate zh-Hans -> /zh-CN/about/ was not built (404)'
    )
  })

  it('rejects the same hreflang emitted twice on one page', () => {
    const site = healthySite()
    site.pages.set('/about/', [
      ...cluster('/about/'),
      { hreflang: 'en', href: `${ORIGIN}/about/` }
    ])

    expect(auditBuiltSite(site)).toContain(
      '/about/: emits hreflang="en" more than once'
    )
  })

  it('rejects a one-way cluster', () => {
    const site = healthySite()
    site.pages.set('/zh-CN/about/', [])
    site.sitemap?.set('/zh-CN/about/', new Set())

    expect(auditBuiltSite(site)).toContain(
      '/about/: lists /zh-CN/about/, which does not list it back'
    )
  })

  it('rejects an alternate on another origin', () => {
    const site = healthySite()
    site.pages.set('/about/', [
      { hreflang: 'en', href: `${ORIGIN}/about/` },
      { hreflang: 'zh-Hans', href: 'https://www.comfy.org/zh-CN/about/' },
      { hreflang: 'x-default', href: `${ORIGIN}/about/` }
    ])

    expect(auditBuiltSite(site)).toContain(
      '/about/: alternate zh-Hans points off-origin (https://www.comfy.org/zh-CN/about/)'
    )
  })

  it('reports a missing sitemap rather than silently skipping it', () => {
    expect(auditBuiltSite({ ...healthySite(), sitemap: null })).toEqual([
      'sitemap-0.xml is missing, so its alternates cannot be checked'
    ])
  })

  it('reports a sitemap and a page that disagree about the cluster', () => {
    const site = healthySite()
    site.sitemap?.set('/about/', new Set(['en', 'zh-Hans', 'x-default', 'ja']))

    expect(auditBuiltSite(site)).toContain(
      '/about/: sitemap advertises ja that the page does not'
    )
  })
})
