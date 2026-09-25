import { LOCALE_CODES, LOCALES } from './locales'
import { models } from './models'
import { isLegacyWorkshopRoute, isWorkshopRoute } from './workshop-release'

const PAYMENT_STATUSES = ['success', 'failed'] as const
const PLACEHOLDER_PATHNAMES = ['/case-studies', '/videos', '/demos'] as const

const ALL_LOCALE_PREFIXES = LOCALE_CODES.map((locale) => LOCALES[locale].prefix)

const NOINDEX_ROUTES = [
  ...PAYMENT_STATUSES.map((status) => `/payment/${status}`),
  '/individual-submission',
  '/booking-confirmation',
  '/agent',
  '/login',
  '/signup',
  '/forgot-password',
  '/models/showcase',
  '/cinematic-studio',
  '/checkout-opening',
  '/checkout-return',
  '/privacy-policy',
  '/terms-of-service',
  ...PLACEHOLDER_PATHNAMES
]

const NOINDEX_PATHNAMES = new Set(
  ALL_LOCALE_PREFIXES.flatMap((prefix) =>
    NOINDEX_ROUTES.map((route) => `${prefix}${route}`)
  )
)

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
