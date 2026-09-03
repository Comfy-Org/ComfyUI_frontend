import { isLocaleInvariantPath } from '../config/routes'
import { JA_PREFIX, LOCALE_PREFIXES, ZH_PREFIX } from '../utils/hreflangRoutes'

export interface Alternate {
  hreflang: 'en' | 'zh-CN' | 'ja' | 'x-default'
  href: string
}

/**
 * English routes that have a Japanese page.
 *
 * Chinese gets a blanket rule because it has a twin for nearly every route.
 * Japanese has one page, so the same blanket rule would advertise around 58
 * Japanese URLs that do not exist, which is the failure this module exists to
 * prevent. Listing the routes is the honest version until P3 generates the
 * Japanese shells, at which point this is generated with them.
 *
 * The list cannot rot silently: `hreflang.test.ts` reads the page tree back and
 * fails when a Japanese page exists that is not listed here, and the build crawl
 * in `scripts/check-hreflang.ts` fails when a listed route was not built.
 *
 * Paths are trimmed of their trailing slash, matching `englishPath`.
 */
const JA_ROUTES: ReadonlySet<string> = new Set(['/'])

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
  const twin = (prefix: string) =>
    new URL(withSlash(`${prefix}${en === '/' ? '' : en}`), origin).href
  const alternates: Alternate[] = [
    { hreflang: 'en', href: enHref },
    { hreflang: 'zh-CN', href: twin(ZH_PREFIX) }
  ]
  if (JA_ROUTES.has(en)) {
    alternates.push({ hreflang: 'ja', href: twin(JA_PREFIX) })
  }
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

/** OG wants underscored locale identifiers, not the BCP 47 tags used elsewhere. */
/**
 * Open Graph wants `language_TERRITORY`, not the BCP 47 tag we route on.
 * A locale missing here would silently declare itself English, so new locales
 * belong in this map at the same time they get a route.
 */
const OG_LOCALES: Record<string, string> = {
  en: 'en_US',
  'zh-CN': 'zh_CN',
  ja: 'ja_JP'
}

export function ogLocale(locale: string): string {
  return OG_LOCALES[locale] ?? OG_LOCALES.en
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
