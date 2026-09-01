import { models } from './models'

const LOCALES = ['en', 'zh-CN'] as const
const DEFAULT_LOCALE = 'en'
const PAYMENT_STATUSES = ['success', 'failed'] as const
const PLACEHOLDER_PATHNAMES = ['/case-studies', '/videos', '/demos'] as const

const LOCALE_PREFIXES = LOCALES.map((locale) =>
  locale === DEFAULT_LOCALE ? '' : `/${locale}`
)

const NOINDEX_PATHNAMES = new Set([
  ...LOCALE_PREFIXES.flatMap((prefix) =>
    PAYMENT_STATUSES.map((status) => `${prefix}/payment/${status}`)
  ),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/individual-submission`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/booking-confirmation`),
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
  return NOINDEX_PATHNAMES.has(normalizePathname(pathname))
}

export function isExcludedFromSitemap(page: string): boolean {
  const pathname = normalizePathname(new URL(page).pathname)
  return (
    NOINDEX_PATHNAMES.has(pathname) || MODEL_REDIRECT_PATHNAMES.has(pathname)
  )
}
