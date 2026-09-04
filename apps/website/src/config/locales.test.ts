import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  LOCALES,
  isPageIndexable,
  localeHasRoute,
  localePrefix
} from './locales'

describe('LOCALES', () => {
  it('is the one list every locale-aware site derives from', () => {
    expect(LOCALE_CODES).toEqual(['en', 'zh-CN', 'ja'])
    expect(DEFAULT_LOCALE).toBe('en')
  })

  it('gives the default locale an empty prefix and every other a real one', () => {
    expect(localePrefix('en')).toBe('')
    expect(localePrefix('zh-CN')).toBe('/zh-CN')
    // Short form for ja while Chinese keeps the legacy /zh-CN. Deliberate: the
    // Chinese URLs rank and a migration would risk that for no SEO gain.
    expect(localePrefix('ja')).toBe('/ja')
  })

  /**
   * The guard. `LocaleConfig` requires every field, so adding a member to
   * `LOCALES` without filling all of them is a compile error. This asserts the
   * same thing at runtime for the fields whose emptiness a type cannot catch.
   */
  it('carries complete metadata for every locale', () => {
    for (const code of LOCALE_CODES) {
      const locale = LOCALES[code]
      expect(locale.code, code).toBe(code)
      expect(locale.name, code).toBeTruthy()
      expect(locale.nativeName, code).toBeTruthy()
      expect(locale.hreflang, code).toBeTruthy()
      expect(['ltr', 'rtl'], code).toContain(locale.dir)
      // Open Graph wants language_TERRITORY, not the BCP 47 tag.
      expect(locale.ogLocale, code).toMatch(/^[a-z]{2}_[A-Z]{2}$/)
    }
  })
})

describe('isPageIndexable', () => {
  /**
   * The single predicate every surface reads: the page's hreflang tags, the
   * sitemap, the canonical and the build assert. They cannot disagree because
   * there is only one answer, and it is knowable before a page renders.
   */
  it('always allows English, which is the source', () => {
    expect(isPageIndexable('en', '/')).toBe(true)
    expect(isPageIndexable('en', '/anything')).toBe(true)
  })

  it('allows a localized page the locale actually serves', () => {
    expect(isPageIndexable('zh-CN', '/cli')).toBe(true)
    expect(isPageIndexable('ja', '/')).toBe(true)
  })

  /**
   * Indexability can never exceed existence. Advertising a page that was never
   * built is the 404-in-a-cluster defect Phase 0 fixed.
   */
  it('never allows a page the locale does not serve', () => {
    expect(isPageIndexable('ja', '/cli')).toBe(false)
    expect(isPageIndexable('ja', '/pricing')).toBe(false)
  })
})

describe('localeHasRoute', () => {
  it('is true for every route in the default locale', () => {
    expect(localeHasRoute('en', '/')).toBe(true)
    expect(localeHasRoute('en', '/cli')).toBe(true)
    expect(localeHasRoute('en', '/anything-at-all')).toBe(true)
  })

  it('is true for zh-CN, which has a twin for nearly every route', () => {
    expect(localeHasRoute('zh-CN', '/')).toBe(true)
    expect(localeHasRoute('zh-CN', '/cli')).toBe(true)
  })

  /**
   * Japanese is a partial locale: one page today. Callers use this so a link or
   * an hreflang alternate is only offered where the page really exists, rather
   * than pointing at a 404.
   */
  it('is true only for the Japanese routes that exist', () => {
    expect(localeHasRoute('ja', '/')).toBe(true)
    expect(localeHasRoute('ja', '/cli')).toBe(false)
    expect(localeHasRoute('ja', '/pricing')).toBe(false)
  })
})
