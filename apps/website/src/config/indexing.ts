import { isProductionBuild } from './build-env'
import { HUB_WORKFLOWS_PATH } from './hub-models'
import { LOCALE_CODES, LOCALES } from './locales'
import type { ModelPageLaunch } from './model-page-launch'
import { launchedModelPages, launchedWorkflowPages } from './model-page-launch'
import { models } from './models'
import { modelsUrlKind, modelsUrlPaths } from './models-url-registry'
import { workshopModels } from './workshop-browse-content'
import { isLegacyWorkshopRoute, isWorkshopRoute } from './workshop-release'

const PAYMENT_STATUSES = ['success', 'failed'] as const
const PLACEHOLDER_PATHNAMES = ['/case-studies', '/videos', '/demos'] as const

const ALL_LOCALE_PREFIXES = LOCALE_CODES.map((locale) => LOCALES[locale].prefix)

export const NOINDEX_ROUTES = [
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
] as const

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

export function routerIdsByModelPage(
  modelPaths: readonly string[],
  pages: readonly { href?: string; routerId: string }[]
): ReadonlyMap<string, string> {
  const routerIdByHref = new Map(
    pages.flatMap(({ href, routerId }) =>
      href === undefined ? [] : [[normalizePathname(href), routerId] as const]
    )
  )
  const unmatched = modelPaths.filter((path) => !routerIdByHref.has(path))
  if (unmatched.length > 0)
    throw new Error(`Model pages with no Router id: ${unmatched.join(', ')}`)
  return routerIdByHref
}

const routerIdByModelPage = routerIdsByModelPage(
  modelsUrlPaths('model'),
  workshopModels
)

export function isIndexableModelPage(
  pathname: string,
  launched: ModelPageLaunch = launchedModelPages,
  workflowsLaunched: boolean = launchedWorkflowPages
): boolean {
  const kind = modelsUrlKind(pathname)
  if (kind === 'workflow') return workflowsLaunched
  if (kind === 'section')
    return (
      normalizePathname(pathname) === HUB_WORKFLOWS_PATH && workflowsLaunched
    )
  if (kind !== 'model') return false
  const routerId = routerIdByModelPage.get(normalizePathname(pathname))
  return (
    routerId !== undefined && (launched === 'all' || launched.has(routerId))
  )
}

export function isExcludedFromSitemap(
  page: string,
  launched: ModelPageLaunch = launchedModelPages,
  workflowsLaunched: boolean = launchedWorkflowPages
): boolean {
  const pathname = normalizePathname(new URL(page).pathname)
  return (
    isNoindexPathname(pathname) ||
    isLegacyWorkshopRoute(pathname) ||
    MODEL_REDIRECT_PATHNAMES.has(pathname) ||
    (isWorkshopRoute(pathname) &&
      !isIndexableModelPage(pathname, launched, workflowsLaunched))
  )
}
