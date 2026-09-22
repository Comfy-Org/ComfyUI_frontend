import { LOCALE_CODES, LOCALES } from './locales'
import { models } from './models'
import { isLegacyWorkshopRoute, isWorkshopRoute } from './workshop-release'

const PAYMENT_STATUSES = ['success', 'failed'] as const
const PLACEHOLDER_PATHNAMES = ['/case-studies', '/videos', '/demos'] as const

const ALL_LOCALE_PREFIXES = LOCALE_CODES.map((locale) => LOCALES[locale].prefix)

const NOINDEX_PATHNAMES = new Set([
  ...ALL_LOCALE_PREFIXES.flatMap((prefix) =>
    PAYMENT_STATUSES.map((status) => `${prefix}/payment/${status}`)
  ),
  ...ALL_LOCALE_PREFIXES.map((prefix) => `${prefix}/individual-submission`),
  ...ALL_LOCALE_PREFIXES.map((prefix) => `${prefix}/booking-confirmation`),
  ...ALL_LOCALE_PREFIXES.map((prefix) => `${prefix}/agent`),
  ...ALL_LOCALE_PREFIXES.map((prefix) => `${prefix}/login`),
  ...ALL_LOCALE_PREFIXES.map((prefix) => `${prefix}/signup`),
  ...ALL_LOCALE_PREFIXES.map((prefix) => `${prefix}/forgot-password`),
  ...ALL_LOCALE_PREFIXES.map((prefix) => `${prefix}/models/showcase`),
  ...ALL_LOCALE_PREFIXES.map((prefix) => `${prefix}/checkout-opening`),
  ...ALL_LOCALE_PREFIXES.map((prefix) => `${prefix}/checkout-return`),
  ...ALL_LOCALE_PREFIXES.map((prefix) => `${prefix}/privacy-policy`),
  ...ALL_LOCALE_PREFIXES.map((prefix) => `${prefix}/terms-of-service`),
  ...ALL_LOCALE_PREFIXES.flatMap((prefix) =>
    PLACEHOLDER_PATHNAMES.map((pathname) => `${prefix}${pathname}`)
  )
])

const MODEL_REDIRECT_PATHNAMES = new Set(
  models
    .filter((model) => model.canonicalSlug !== undefined)
    .flatMap((model) =>
      ALL_LOCALE_PREFIXES.map(
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
