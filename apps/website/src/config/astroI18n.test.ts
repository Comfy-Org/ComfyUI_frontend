import { describe, expect, it } from 'vitest'

import astroConfig from '../../astro.config'
import { DEFAULT_LOCALE, LOCALE_CODES } from './locales'

/**
 * Astro does not validate unknown keys in `astro.config.ts`.
 *
 * `fallbackType` belongs under `i18n.routing`. Put it one level up, directly on
 * `i18n`, and Astro accepts the config, ignores the key, and builds 560 pages
 * that are REDIRECT STUBS rather than real pages — a successful-looking build
 * that silently does the opposite of what was asked. That is what this guards.
 */
describe('astro i18n config', () => {
  const i18n = astroConfig.i18n as
    | {
        locales?: unknown
        defaultLocale?: string
        fallback?: Record<string, string>
        routing?: { prefixDefaultLocale?: boolean; fallbackType?: string }
      }
    | undefined

  it('is configured at all', () => {
    expect(i18n).toBeDefined()
  })

  it('declares every locale the site knows about', () => {
    expect(i18n?.locales).toEqual([...LOCALE_CODES])
    expect(i18n?.defaultLocale).toBe(DEFAULT_LOCALE)
  })

  it('rewrites the fallback in place instead of redirecting', () => {
    // A redirect sends the visitor to /cli/ and shows that in the URL bar, so
    // the localized address stops existing as a page. A rewrite serves the
    // fallback's content at the requested URL, which is what lets one file
    // serve every language.
    expect(i18n?.routing?.fallbackType).toBe('rewrite')
  })

  it('keeps fallbackType under routing, where Astro reads it', () => {
    expect(i18n).not.toHaveProperty('fallbackType')
  })

  it('falls back to English for Japanese', () => {
    expect(i18n?.fallback?.ja).toBe(DEFAULT_LOCALE)
  })

  it('falls back to English for Chinese too', () => {
    // Added in P3-9, which deletes the 47 Chinese page files: without a
    // fallback those URLs would 404. It also mints Chinese URLs for the 401
    // routes that are deliberately English-only, so isExcludedFromSitemap
    // keeps localized copies of locale-invariant routes out of the sitemap and
    // hreflangAlternates refuses to cluster them.
    expect(i18n?.fallback?.['zh-CN']).toBe(DEFAULT_LOCALE)
  })

  it('gives every non-default locale a fallback', () => {
    // A locale with page files but no fallback is fine only while those files
    // exist. Once a locale is served from the English file, a missing entry
    // here is a tree of 404s.
    for (const locale of LOCALE_CODES) {
      if (locale === DEFAULT_LOCALE) continue
      expect(i18n?.fallback?.[locale], `${locale} has no fallback`).toBe(
        DEFAULT_LOCALE
      )
    }
  })
})
