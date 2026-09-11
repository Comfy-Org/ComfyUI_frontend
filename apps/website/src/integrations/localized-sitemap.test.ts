import { describe, expect, it } from 'vitest'

import { missingSitemapEntries, sitemapCandidates } from './localized-sitemap'

const ORIGIN = 'https://comfy.org'

/**
 * `@astrojs/sitemap` builds from Astro's page list, which omits routes produced
 * by the i18n fallback for DYNAMIC routes. Deleting the Chinese page files took
 * the Chinese sitemap from 146 URLs to 32: every `/zh-CN/customers/*`,
 * `/zh-CN/learning/*` and `/zh-CN/cloud/supported-nodes/*` silently vanished,
 * while the pages themselves still advertised a cluster. `check:hreflang`
 * caught it as 114 "advertises alternates but the sitemap omits it".
 */
describe('missingSitemapEntries', () => {
  it('adds a built page the sitemap left out', () => {
    const entries = missingSitemapEntries(
      ['/zh-CN/customers/acme/'],
      new Set([`${ORIGIN}/customers/acme/`]),
      ORIGIN
    )

    expect(entries).toHaveLength(1)
    expect(entries[0]).toContain(`<loc>${ORIGIN}/zh-CN/customers/acme/</loc>`)
  })

  it('leaves a page the sitemap already lists alone', () => {
    expect(
      missingSitemapEntries(
        ['/customers/acme/'],
        new Set([`${ORIGIN}/customers/acme/`]),
        ORIGIN
      )
    ).toEqual([])
  })

  it('never adds a page that is excluded from the sitemap', () => {
    // Held-back Japanese, a localized copy of an English-only route, and a
    // noindex page must not be resurrected by this.
    expect(
      missingSitemapEntries(
        [
          '/ja/mcp/',
          '/zh-CN/p/supported-models/grok-imagine/',
          '/zh-CN/payment/success/'
        ],
        new Set(),
        ORIGIN
      )
    ).toEqual([])
  })

  it('never adds a redirect stub', () => {
    // /zh-CN/cloud/pricing is a meta-refresh to /zh-CN/pricing/. Listing it
    // advertised a cluster the stub does not carry, which check:hreflang
    // rejected as "sitemap advertises ... that the page does not".
    expect(
      missingSitemapEntries(
        ['/zh-CN/cloud/pricing/'],
        new Set(),
        ORIGIN,
        new Set(['/zh-CN/cloud/pricing/'])
      )
    ).toEqual([])
  })

  it('carries the same alternates the page itself advertises', () => {
    const [entry] = missingSitemapEntries(
      ['/zh-CN/pricing/'],
      new Set(),
      ORIGIN
    )

    expect(entry).toContain(`hreflang="zh-CN" href="${ORIGIN}/zh-CN/pricing/"`)
    expect(entry).toContain(`hreflang="en" href="${ORIGIN}/pricing/"`)
  })
})

describe('sitemapCandidates', () => {
  const origin = 'https://comfy.org'

  /**
   * The set this returns is what gets read from disk: deciding whether a path
   * is a redirect stub means opening its `index.html`. Passing every built page
   * to that check read hundreds of files whose content was then discarded
   * unread, and the count grows with every locale added.
   */
  it('drops paths the sitemap already lists', () => {
    const listed = new Set([`${origin}/zh-CN/about/`])

    expect(
      sitemapCandidates(['/zh-CN/about/', '/zh-CN/cloud/'], listed, origin)
    ).toEqual(['/zh-CN/cloud/'])
  })

  it('drops paths excluded from the sitemap', () => {
    const kept = sitemapCandidates(
      ['/zh-CN/cloud/', '/zh-CN/terms-of-service/'],
      new Set(),
      origin
    )

    expect(kept).toContain('/zh-CN/cloud/')
    expect(kept).not.toContain('/zh-CN/terms-of-service/')
  })

  it('is the same set the entry builder walks', () => {
    const paths = ['/zh-CN/cloud/', '/zh-CN/about/']
    const listed = new Set([`${origin}/zh-CN/about/`])

    // Every candidate that is not a redirect stub becomes an entry, so the two
    // cannot disagree about which paths matter.
    expect(missingSitemapEntries(paths, listed, origin).length).toBe(
      sitemapCandidates(paths, listed, origin).length
    )
  })
})
