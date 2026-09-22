import type { Hreflang } from '../config/locales'
import {
  LOCALE_CODES,
  LOCALES,
  NON_DEFAULT_LOCALE_PREFIXES,
  localeHasRoute,
  resolveLocale
} from '../config/locales'
import { isLocaleInvariantPath } from '../config/routes'

export interface Alternate {
  hreflang: Hreflang | 'x-default'
  href: string
}

function trimSlash(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

function withSlash(pathname: string): string {
  return pathname === '/' ? '/' : `${pathname}/`
}

function englishPath(pathname: string): string {
  const path = trimSlash(pathname)
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
  if (en === '/404' || isLocaleInvariantPath(en)) return []

  const enHref = new URL(withSlash(en), origin).href
  const alternates: Alternate[] = LOCALE_CODES.filter((locale) =>
    localeHasRoute(locale, en)
  ).map((locale) => ({
    hreflang: LOCALES[locale].hreflang,
    href: new URL(
      withSlash(`${LOCALES[locale].prefix}${en === '/' ? '' : en}`),
      origin
    ).href
  }))
  alternates.push({ hreflang: 'x-default', href: enHref })
  return alternates
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

export function ogLocale(locale: string): string {
  return LOCALES[resolveLocale(locale)].ogLocale
}

export function ogLocaleAlternates(
  locale: string,
  alternates: Alternate[]
): string[] {
  const currentLocale = resolveLocale(locale)
  return LOCALE_CODES.filter(
    (code) =>
      code !== currentLocale &&
      alternates.some(
        (alternate) => alternate.hreflang === LOCALES[code].hreflang
      )
  ).map((code) => LOCALES[code].ogLocale)
}
