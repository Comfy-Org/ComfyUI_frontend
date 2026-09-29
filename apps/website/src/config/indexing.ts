import { isProductionBuild } from './build-env'
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
  '/platform/serverless-animation',
  ...PLACEHOLDER_PATHNAMES
]

const NOINDEX_PATHNAMES = new Set([
  ...ALL_LOCALE_PREFIXES.flatMap((prefix) =>
    NOINDEX_ROUTES.map((route) => `${prefix}${route}`)
  ),
  // Both /agent and /zh-CN/agent are real, indexable, localized pages. Only
  // the older /comfy-agent preview route stays out of the index.
  '/comfy-agent'
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

export function isIndexableBuild(): boolean {
  if (process.env.VERCEL_ENV) return isProductionBuild()
  return process.env.WEBSITE_INDEXABLE === '1'
}

interface HeadIndexingInput {
  pageNoindex: boolean
  indexableBuild: boolean
}

export function headIndexing({
  pageNoindex,
  indexableBuild
}: HeadIndexingInput) {
  const robotsNoindex = pageNoindex || !indexableBuild
  return {
    robotsNoindex,
    emitCanonical: indexableBuild,
    emitAlternates: !robotsNoindex,
    emitStructuredData: !pageNoindex,
    emitMarkdownTwinLink: !pageNoindex
  }
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
