import type { Locale } from '@/config/locales'
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  LOCALES,
  isLocale
} from '@/config/locales'

/**
 * Locales the content catalog (CMS-backed Hub) serves. Every site locale is a
 * catalog locale, so a new site locale gets Hub routes, translated content and
 * hreflang without another list to update. Content falls back to the record's
 * source text when a reviewed translation for the locale is missing.
 */
export const CATALOG_LOCALES: readonly Locale[] = LOCALE_CODES

export type CatalogLocale = Locale

export function isCatalogLocale(value: unknown): value is CatalogLocale {
  return typeof value === 'string' && isLocale(value)
}

/** URL prefix for a catalog locale: '' for English, '/zh-CN' for Chinese. */
export function catalogLocalePrefix(locale: string): string {
  return isCatalogLocale(locale) ? LOCALES[locale].prefix : ''
}

/** The catalog locale named by a path prefix (`/ja/hub/...` → `ja`). */
export function catalogLocaleFromPath(
  pathname: string
): CatalogLocale | undefined {
  return CATALOG_LOCALES.find((locale) => {
    const prefix = LOCALES[locale].prefix
    return (
      prefix !== '' &&
      (pathname === prefix || pathname.startsWith(`${prefix}/`))
    )
  })
}

/**
 * The request's catalog locale: an explicit path prefix wins, then a valid
 * preview cookie, then English.
 */
export function resolveCatalogLocale(
  pathname: string,
  cookie: string | undefined
): CatalogLocale {
  return (
    catalogLocaleFromPath(pathname) ??
    (isCatalogLocale(cookie) ? cookie : DEFAULT_LOCALE)
  )
}

/** Non-English catalog locales, whose Hub routes carry a path prefix. */
export const PREFIXED_CATALOG_LOCALES: readonly CatalogLocale[] =
  CATALOG_LOCALES.filter((locale) => LOCALES[locale].prefix !== '')

// Compact labels the staff preview controls already use; other locales show
// their native name.
const PREVIEW_LABELS: Partial<Record<CatalogLocale, string>> = {
  en: 'English',
  'zh-CN': '中文'
}

/** Language choices for staff preview controls, in site order. */
export const CATALOG_LOCALE_OPTIONS = CATALOG_LOCALES.map((code) => ({
  code,
  label: PREVIEW_LABELS[code] ?? LOCALES[code].nativeName
}))

/** Prefix `pathname` for `locale` unless it already carries that prefix. */
export function withCatalogLocalePrefix(
  pathname: string,
  locale: string
): string {
  const prefix = catalogLocalePrefix(locale)
  if (!prefix || pathname === prefix || pathname.startsWith(`${prefix}/`))
    return pathname
  return `${prefix}${pathname}`
}

const LOCALE_BADGES: Partial<Record<CatalogLocale, string>> = {
  en: 'EN',
  'zh-CN': '中',
  ja: '日'
}

/** Short badge for a compact language control (`EN`, `中`, `日`). */
export function catalogLocaleBadge(locale: string): string {
  return isCatalogLocale(locale)
    ? (LOCALE_BADGES[locale] ?? locale.toUpperCase())
    : 'EN'
}

/** `pathname` without its catalog locale prefix (`/ja/hub/x/` → `/hub/x/`). */
export function withoutCatalogLocalePrefix(pathname: string): string {
  const locale = catalogLocaleFromPath(pathname)
  return locale
    ? pathname.slice(catalogLocalePrefix(locale).length) || '/'
    : pathname
}
