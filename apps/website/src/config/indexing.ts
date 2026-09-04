import { models } from './models'

const LOCALES = ['en', 'zh-CN'] as const
const DEFAULT_LOCALE = 'en'
const PAYMENT_STATUSES = ['success', 'failed'] as const
const PLACEHOLDER_PATHNAMES = ['/case-studies', '/videos', '/demos'] as const
const NOINDEX_PREFIXES = ['/workshop'] as const

const LOCALE_PREFIXES = LOCALES.map((locale) =>
  locale === DEFAULT_LOCALE ? '' : `/${locale}`
)

const NOINDEX_PATHNAMES = new Set([
  ...LOCALE_PREFIXES.flatMap((prefix) =>
    PAYMENT_STATUSES.map((status) => `${prefix}/payment/${status}`)
  ),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/individual-submission`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/booking-confirmation`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/agent`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/login`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/signup`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/forgot-password`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/privacy-policy`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/terms-of-service`),
  ...LOCALE_PREFIXES.flatMap((prefix) =>
    PLACEHOLDER_PATHNAMES.map((pathname) => `${prefix}${pathname}`)
  )
])

const MODEL_REDIRECT_PATHNAMES = new Set(
  models
    .filter((model) => model.canonicalSlug !== undefined)
    .flatMap((model) =>
      LOCALE_PREFIXES.map(
        (prefix) => `${prefix}/p/supported-models/${model.slug}`
      )
    )
)

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/$/, '')
}

export function isNoindexPathname(pathname: string): boolean {
  const normalized = normalizePathname(pathname)
  return (
    NOINDEX_PATHNAMES.has(normalized) ||
    NOINDEX_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    )
  )
}

export function isExcludedFromSitemap(page: string): boolean {
  const pathname = normalizePathname(new URL(page).pathname)
  return isNoindexPathname(pathname) || MODEL_REDIRECT_PATHNAMES.has(pathname)
}
