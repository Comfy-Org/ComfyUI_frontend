import { isLocaleInvariantPath } from '../config/routes'

const LOCALE_PREFIX = '/zh-CN'

export interface Alternate {
  hreflang: 'en' | 'zh-CN' | 'x-default'
  href: string
}

function trimSlash(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

function withSlash(pathname: string): string {
  return pathname === '/' ? '/' : `${pathname}/`
}

/** The English path a page belongs to, whichever locale rendered it. */
function englishPath(pathname: string): string {
  const path = trimSlash(pathname)
  if (path === LOCALE_PREFIX) return '/'
  return path.startsWith(`${LOCALE_PREFIX}/`)
    ? path.slice(LOCALE_PREFIX.length)
    : path
}

/**
 * hreflang alternates for a page: the English page, its zh-CN twin, and
 * x-default on English. English-only routes get none, so no alternate ever
 * points at a redirect stub or a 404.
 */
export function hreflangAlternates(
  pathname: string,
  origin: string
): Alternate[] {
  const en = englishPath(pathname)
  // Japanese has one page and no twin rule yet, so anything under /ja/ emits
  // nothing rather than a cluster. Without this the homepage advertises
  // /zh-CN/ja/, which does not exist: the same lie this function's English-only
  // guard exists to prevent. Read off the English path so a locale-prefixed
  // request is suppressed too. Clustering ja properly is BE-11285.
  if (en === '/ja' || en.startsWith('/ja/')) return []
  if (en === '/404' || isLocaleInvariantPath(en)) return []
  const enHref = new URL(withSlash(en), origin).href
  return [
    { hreflang: 'en', href: enHref },
    {
      hreflang: 'zh-CN',
      href: new URL(
        withSlash(`${LOCALE_PREFIX}${en === '/' ? '' : en}`),
        origin
      ).href
    },
    { hreflang: 'x-default', href: enHref }
  ]
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

/** The OG identifier for the other language, when this page has one. */
export function ogLocaleAlternate(
  locale: string,
  alternates: Alternate[]
): string | null {
  if (alternates.length === 0) return null
  return locale === 'zh-CN' ? 'en_US' : 'zh_CN'
}
