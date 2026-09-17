import { LOCALE_CODES, localePrefix } from './locales'
import { models } from './models'
import { isLegacyWorkshopRoute, isWorkshopRoute } from './workshop-release'

const PAYMENT_STATUSES = ['success', 'failed'] as const
const PLACEHOLDER_PATHNAMES = ['/case-studies', '/videos', '/demos'] as const

const LOCALE_PREFIXES = LOCALE_CODES.map(localePrefix)

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
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/models/showcase`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/checkout-opening`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/checkout-return`),
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
    isNoindexPathname(pathname) ||
    isLegacyWorkshopRoute(pathname) ||
    MODEL_REDIRECT_PATHNAMES.has(pathname) ||
    isWorkshopRoute(pathname)
  )
}
