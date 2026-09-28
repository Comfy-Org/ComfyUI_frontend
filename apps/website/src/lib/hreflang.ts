import type { Hreflang, Locale } from '../config/locales'
import {
  LOCALE_CODES,
  LOCALES,
  NON_DEFAULT_LOCALE_PREFIXES,
  normalizeRoute,
  withRouteSlash
} from '../config/locales'
import { supportsLocaleRoute } from '../config/routes'

export interface Alternate {
  hreflang: Hreflang | 'x-default'
  href: string
}

function englishPath(pathname: string): string {
  const path = normalizeRoute(pathname)
  for (const prefix of NON_DEFAULT_LOCALE_PREFIXES) {
    if (path === prefix) return '/'
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length)
  }
  return path
}

export function hreflangAlternates(
  pathname: string,
  origin: string
): Alternate[] {
  const en = englishPath(pathname)
<<<<<<< HEAD
  // Japanese has one page and no twin rule yet, so anything under /ja/ emits
  // nothing rather than a cluster. Without this the homepage advertises
  // /zh-CN/ja/, which does not exist: the same lie this function's English-only
  // guard exists to prevent. Read off the English path so a locale-prefixed
  // request is suppressed too. Clustering ja properly is BE-11285.
  if (en === '/ja' || en.startsWith('/ja/')) return []
  if (en === '/404' || isLocaleInvariantPath(en)) return []
  const zh = `${LOCALE_PREFIX}${en === '/' ? '' : en}`
  if (isNoindexPathname(en) || isNoindexPathname(zh)) return []
  const enHref = new URL(withSlash(en), origin).href
  return [
    { hreflang: 'en', href: enHref },
    {
      hreflang: 'zh-CN',
      href: new URL(withSlash(zh), origin).href
    },
    { hreflang: 'x-default', href: enHref }
  ]
||||||| d37324f7b
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
=======
  const locales = LOCALE_CODES.filter((locale) =>
    supportsLocaleRoute(locale, en)
  )
  if (locales.length === 0) return []

  const enHref = new URL(withRouteSlash(en), origin).href
  const alternates: Alternate[] = locales.map((locale) => ({
    hreflang: LOCALES[locale].hreflang,
    href: new URL(
      withRouteSlash(`${LOCALES[locale].prefix}${en === '/' ? '' : en}`),
      origin
    ).href
  }))
  alternates.push({ hreflang: 'x-default', href: enHref })
  return alternates
>>>>>>> refs/rewritten/origin-main
}

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

export function ogLocale(locale: Locale): string {
  return LOCALES[locale].ogLocale
}

export function ogLocaleAlternates(
  locale: Locale,
  alternates: Alternate[]
): string[] {
  return LOCALE_CODES.filter(
    (code) =>
      code !== locale &&
      alternates.some(
        (alternate) => alternate.hreflang === LOCALES[code].hreflang
      )
  ).map((code) => LOCALES[code].ogLocale)
}
