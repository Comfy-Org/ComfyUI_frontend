import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  LOCALE_PREFIXES,
  LOCALES,
  isPageIndexable,
  localePrefix,
  isLocale,
  type Locale
} from '../config/locales'
import { isLocaleInvariantPath } from '../config/routes'

export interface Alternate {
  hreflang: Locale | 'x-default'
  href: string
}

function trimSlash(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

function withSlash(pathname: string): string {
  return pathname === '/' ? '/' : `${pathname}/`
}

/**
 * The English path a page belongs to, whichever locale rendered it.
 *
 * Every locale prefix is stripped, not just Chinese. Reading `/ja/` as the
 * English route `/ja` is what labelled the Japanese home page `en` and pointed
 * its cluster at `/zh-CN/ja/`, which 404s.
 */
function englishPath(pathname: string): string {
  const path = trimSlash(pathname)
  for (const prefix of LOCALE_PREFIXES) {
    if (path === prefix) return '/'
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length)
  }
  return path
}

/**
 * hreflang alternates for a page: the English page, its zh-CN twin, its ja twin
 * where one exists, and x-default on English. English-only routes get none, so
 * no alternate ever points at a redirect stub or a 404.
 */
export function hreflangAlternates(
  pathname: string,
  origin: string
): Alternate[] {
  const en = englishPath(pathname)
  if (en === '/404' || isLocaleInvariantPath(en)) return []
  const enHref = new URL(withSlash(en), origin).href
  const twin = (locale: Locale) =>
    new URL(withSlash(`${localePrefix(locale)}${en === '/' ? '' : en}`), origin)
      .href
  // `isPageIndexable` is the single predicate: it already asks whether the
  // locale serves this route, and additionally whether that page is allowed to
  // be indexed. Both the page tags and the sitemap read it, so they cannot
  // disagree about a cluster.
  const alternates: Alternate[] = LOCALE_CODES.filter((locale) =>
    isPageIndexable(locale, en)
  ).map((locale) => ({
    hreflang: LOCALES[locale].hreflang as Locale,
    href: locale === DEFAULT_LOCALE ? enHref : twin(locale)
  }))
  alternates.push({ hreflang: 'x-default', href: enHref })
  return alternates
}

/** `xhtml:link` alternates for one sitemap entry, or nothing for English-only pages. */
export function sitemapAlternates(
  url: string
): { url: string; lang: string }[] | undefined {
  const { pathname, origin } = new URL(url)
  const alternates = hreflangAlternates(pathname, origin)
  return alternates.length > 0
    ? alternates.map((alternate) => ({
        url: alternate.href,
        lang: alternate.hreflang
      }))
    : undefined
}

/**
 * Open Graph wants `language_TERRITORY`, not the BCP 47 tag we route on.
 *
 * Read off `LOCALES` rather than kept as a second map here. The old map could
 * fall out of step with the locale list, and a locale missing from it silently
 * declared itself English.
 */
export function ogLocale(locale: string): string {
  return isLocale(locale)
    ? LOCALES[locale].ogLocale
    : LOCALES[DEFAULT_LOCALE].ogLocale
}

/**
 * The OG identifier for the other language, when this page has one.
 *
 * Open Graph takes a single alternate here, so a localized page names English
 * and English names Chinese. Testing for `en` rather than `zh-CN` matters now
 * that a third locale exists: the old form sent Japanese pages to `zh_CN`,
 * pairing them with a language they have nothing to do with.
 */
export function ogLocaleAlternate(
  locale: string,
  alternates: Alternate[]
): string | null {
  if (alternates.length === 0) return null
  return locale === 'en' ? 'zh_CN' : 'en_US'
}
