import { describe, expect, it } from 'vitest'
import { isExcludedFromSitemap, isNoindexPathname } from './indexing'

describe('indexing policy', () => {
  it.for([
    '/privacy-policy',
    '/privacy-policy/',
    '/zh-CN/privacy-policy',
    '/terms-of-service',
    '/zh-CN/terms-of-service/',
    '/payment/success',
    '/zh-CN/payment/failed/',
    '/individual-submission',
    '/zh-CN/booking-confirmation/',
    '/case-studies',
    '/zh-CN/videos/',
    '/demos'
  ])('marks %s as noindex', (pathname) => {
    expect(isNoindexPathname(pathname)).toBe(true)
    expect(isExcludedFromSitemap(`https://comfy.org${pathname}`)).toBe(true)
  })

  it.for([
    '/privacy',
    '/pricing',
    '/p/supported-models/grok-imagine',
    '/demos/image-to-video'
  ])('keeps %s indexable', (pathname) => {
    expect(isNoindexPathname(pathname)).toBe(false)
    expect(isExcludedFromSitemap(`https://comfy.org${pathname}`)).toBe(false)
  })

  it('derives model redirect exclusions from canonical model metadata', () => {
    expect(
      isExcludedFromSitemap('https://comfy.org/p/supported-models/qwen-3-8b/')
    ).toBe(true)
    expect(
      isExcludedFromSitemap(
        'https://comfy.org/zh-CN/p/supported-models/grok-image/'
      )
    ).toBe(true)
  })
})

describe('localized pages the site is not ready to expose', () => {
  /**
   * Astro's i18n fallback builds a page for EVERY route in a fallback locale,
   * so /ja/ went from one page to 560 the moment it was enabled. The pages
   * themselves behave: they canonical to English and leave ja out of their
   * hreflang cluster. The sitemap did not, because it knew nothing about
   * INDEXABLE_PAGES, and listed 43 Japanese URLs the site does not advertise.
   *
   * A sitemap disagreeing with a page's own tags is the defect Phase 0 fixed.
   * One predicate, every surface.
   */
  it('keeps a fallback page out of the sitemap', () => {
    expect(isExcludedFromSitemap('https://comfy.org/ja/pricing/')).toBe(true)
    expect(isExcludedFromSitemap('https://comfy.org/ja/cli/')).toBe(true)
  })

  it('keeps the one Japanese page that IS ready', () => {
    expect(isExcludedFromSitemap('https://comfy.org/ja/')).toBe(false)
  })

  it('leaves Chinese alone, since it is complete', () => {
    expect(isExcludedFromSitemap('https://comfy.org/zh-CN/pricing/')).toBe(
      false
    )
  })

  it('leaves English alone', () => {
    expect(isExcludedFromSitemap('https://comfy.org/pricing/')).toBe(false)
  })
})

describe('localized copies of English-only routes', () => {
  /**
   * P3-9 gives Chinese a fallback so its 47 page files can be deleted. Astro's
   * fallback is per-locale with no route granularity, so it also mints Chinese
   * URLs for the 401 routes that are deliberately English-only — the model
   * catalogue, Enterprise, the legal documents. Chinese is marked 'all' in
   * INDEXABLE_PAGES, so without this they would enter the sitemap the moment
   * they exist, advertising Chinese pages that are English content.
   *
   * hreflang already refuses to cluster them. This is the same answer on the
   * sitemap surface.
   */
  it.for([
    'https://comfy.org/zh-CN/p/supported-models/grok-imagine/',
    'https://comfy.org/zh-CN/enterprise/',
    'https://comfy.org/zh-CN/enterprise-msa/',
    'https://comfy.org/zh-CN/pixal3d-trellis2/',
    'https://comfy.org/ja/p/supported-models/grok-imagine/'
  ])('keeps %s out of the sitemap', (url) => {
    expect(isExcludedFromSitemap(url)).toBe(true)
  })

  it('still lists the English original', () => {
    expect(
      isExcludedFromSitemap(
        'https://comfy.org/p/supported-models/grok-imagine/'
      )
    ).toBe(false)
    expect(isExcludedFromSitemap('https://comfy.org/enterprise/')).toBe(false)
  })

  it('still lists a Chinese page that is genuinely served', () => {
    expect(isExcludedFromSitemap('https://comfy.org/zh-CN/pricing/')).toBe(
      false
    )
  })
})

describe('the not-found page, in every locale', () => {
  /**
   * Astro keeps /404 out of the sitemap itself, but only the exact route. Once
   * Chinese gained a fallback, /zh-CN/404 was generated and sailed past both
   * guards: Astro did not recognise it, and Chinese is 'all' in
   * INDEXABLE_PAGES. Japanese never hit this because its allowlist holds
   * everything back.
   */
  it.for(['https://comfy.org/zh-CN/404/', 'https://comfy.org/ja/404/'])(
    'keeps %s out of the sitemap',
    (url) => {
      expect(isExcludedFromSitemap(url)).toBe(true)
    }
  )

  it('leaves the English 404 to Astro, which already omits it', () => {
    // This predicate also decides which pages get a markdown twin. Excluding
    // the English 404 here would delete /404.md as a side effect.
    expect(isExcludedFromSitemap('https://comfy.org/404/')).toBe(false)
  })
})
