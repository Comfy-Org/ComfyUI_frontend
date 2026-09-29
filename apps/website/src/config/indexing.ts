import { LOCALE_CODES, LOCALES } from './locales'
import { MODEL_PAGES_INDEXABLE } from './model-page-launch'
import { models } from './models'
import { modelsUrlKind } from './models-url-registry'
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
  '/models/apps/cinematic-studio',
  '/models/apps/reshoot',
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

export function isIndexableModelPage(pathname: string): boolean {
  return MODEL_PAGES_INDEXABLE && modelsUrlKind(pathname) === 'model'
}

export function isExcludedFromSitemap(page: string): boolean {
  const pathname = normalizePathname(new URL(page).pathname)
  return (
    isNoindexPathname(pathname) ||
    isLegacyWorkshopRoute(pathname) ||
    MODEL_REDIRECT_PATHNAMES.has(pathname) ||
    (isWorkshopRoute(pathname) && !isIndexableModelPage(pathname))
  )
}
