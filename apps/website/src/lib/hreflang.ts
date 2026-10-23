import { isNoindexPathname } from '@/config/indexing'
import type { Hreflang, Locale } from '@/config/locales'
import {
  LOCALE_CODES,
  LOCALES,
  NON_DEFAULT_LOCALE_PREFIXES,
  normalizeRoute,
  withRouteSlash
} from '@/config/locales'
import { supportsLocaleRoute } from '@/config/routes'

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

export interface LocaleAlternate {
  locale: Locale
  path: string
}

export function localeAlternates(pathname: string): LocaleAlternate[] {
  const en = englishPath(pathname)
  return LOCALE_CODES.flatMap((locale) => {
    if (!supportsLocaleRoute(locale, en)) return []
    const path = withRouteSlash(
      `${LOCALES[locale].prefix}${en === '/' ? '' : en}`
    )
    return [{ locale, path }]
  })
}

export function hreflangAlternates(
  pathname: string,
  origin: string
): Alternate[] {
  const locales = localeAlternates(pathname).filter(
    ({ path }) => !isNoindexPathname(path)
  )
  // A cluster needs at least one translation to link to; a lone indexable
  // page has nothing to pair with, so hreflang has nothing to say.
  if (locales.length < 2) return []

  const alternates: Alternate[] = locales.map(({ locale, path }) => ({
    hreflang: LOCALES[locale].hreflang,
    href: new URL(path, origin).href
  }))
  alternates.push({
    hreflang: 'x-default',
    href: new URL(withRouteSlash(englishPath(pathname)), origin).href
  })
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
