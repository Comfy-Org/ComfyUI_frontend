import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  LOCALE_PREFIXES,
  LOCALES,
  isPageIndexable,
  localePrefix,
  isLocale
} from '../config/locales'
import type { Locale } from '../config/locales'
import { isLocaleInvariantPath, localizeHref } from '../config/routes'

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
  origin: string,
  pageLocale: Locale = DEFAULT_LOCALE
): Alternate[] {
  const en = englishPath(pathname)
  if (en === '/404' || isLocaleInvariantPath(en)) return []

  // A page whose OWN locale is held back belongs in no cluster. Astro's i18n
  // fallback builds /ja/<route> for every route while only / is on the Japanese
  // allowlist; those pages were emitting the English cluster, which nothing in
  // that cluster listed back, so the site advertised a one-way relationship and
  // the pages appeared to claim membership of a group they are held out of.
  //
  // The locale must be PASSED IN, not read from the path. During a rewritten
  // fallback render Astro reports the ENGLISH pathname while
  // `Astro.currentLocale` is the requested locale, so a path-derived answer is
  // `en` for every fallback page and this rule would never fire. That version
  // passed its unit test and changed nothing in the build.
  if (!isPageIndexable(pageLocale, en)) return []
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
    hreflang: LOCALES[locale].hreflang,
    href: locale === DEFAULT_LOCALE ? enHref : twin(locale)
  }))
  alternates.push({ hreflang: 'x-default', href: enHref })
  return alternates
}

/**
 * The canonical path for a page, given the locale it is rendering for.
 *
 * Cannot be taken from the pathname Astro reports. Once a locale is served by
 * the i18n fallback, Astro reports the ENGLISH path during the render, so a
 * canonical built from it declares the English page the original — correct for
 * a held-back locale, catastrophic for a translated one. Chinese is fully
 * translated, and deleting its page files turns every /zh-CN/ URL into a
 * fallback render, so this decides whether the Chinese site keeps its identity
 * in search.
 *
 * The rule is the same predicate everything else reads: a page published in its
 * locale is its own original; one that is held back points at English.
 */
export function canonicalPath(pathname: string, pageLocale: Locale): string {
  const en = englishPath(pathname)
  const path = isPageIndexable(pageLocale, en)
    ? localizeHref(en, pageLocale)
    : en
  // The site canonicalises with a trailing slash everywhere. Returning the bare
  // path here would rewrite the canonical of all 1,291 pages.
  return withSlash(trimSlash(path))
}

/** `xhtml:link` alternates for one sitemap entry, or nothing for English-only pages. */
export function sitemapAlternates(
  url: string
): { url: string; lang: string }[] | undefined {
  const { pathname, origin } = new URL(url)
  // Unlike a page render, a sitemap entry's path IS the localized one, so the
  // locale can be read off it here.
  const pageLocale =
    LOCALE_CODES.find(
      (locale) =>
        locale !== DEFAULT_LOCALE &&
        pathname.startsWith(`${localePrefix(locale)}/`)
    ) ?? DEFAULT_LOCALE
  const alternates = hreflangAlternates(pathname, origin, pageLocale)
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
  // The target has to be in this page's own cluster. A non-empty cluster was
  // not enough: an English-only route still carries `en` and `x-default`, so
  // every one of them advertised a Chinese alternate for a page that does not
  // exist. No page does that today, but nothing stopped it.
  const target = locale === 'en' ? 'zh-CN' : 'en'
  if (!alternates.some((alternate) => alternate.hreflang === target)) {
    return null
  }
  return target === 'zh-CN' ? 'zh_CN' : 'en_US'
}
