import { LANGUAGES, DEFAULT_LOCALE } from './config'
import type { Locale } from './config'

// Get locale from URL path
export function getLocaleFromPath(pathname: string): Locale {
  const segments = pathname.split('/').filter(Boolean)
  const firstSegment = segments[0]
  if (
    firstSegment &&
    firstSegment in LANGUAGES &&
    firstSegment !== DEFAULT_LOCALE
  ) {
    return firstSegment as Locale
  }
  return DEFAULT_LOCALE
}

// Build localized URL
export function localizeUrl(path: string, locale: Locale): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  if (locale === DEFAULT_LOCALE) {
    return cleanPath
  }
  return `/${locale}${cleanPath}`
}

// Get all localized versions of a URL for hreflang
export function getAlternateUrls(
  basePath: string
): { locale: Locale; url: string }[] {
  return Object.keys(LANGUAGES).map((locale) => ({
    locale: locale as Locale,
    url: localizeUrl(basePath, locale as Locale)
  }))
}

// Get language info
export function getLanguageInfo(locale: Locale) {
  return LANGUAGES[locale]
}

// Check if locale uses RTL
export function isRTL(locale: Locale): boolean {
  return LANGUAGES[locale]?.dir === 'rtl'
}
