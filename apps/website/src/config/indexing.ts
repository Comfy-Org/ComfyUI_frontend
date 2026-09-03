import { LOCALE_CODES, localePrefix } from './locales'
import { models } from './models'

const PAYMENT_STATUSES = ['success', 'failed'] as const
const PLACEHOLDER_PATHNAMES = ['/case-studies', '/videos', '/demos'] as const

/**
 * Every locale's prefix, the default's empty one included.
 *
 * This list used to be declared here and named only `en` and `zh-CN`, so it
 * never learned about Japanese. Nothing broke while `/ja/` was a single page,
 * but the noindex set below is built from it: the moment P3 generates
 * `/ja/privacy-policy` and the rest, they would have been indexable. Deriving
 * it from `LOCALES` is what makes that impossible to forget again.
 */
const LOCALE_PREFIXES = LOCALE_CODES.map(localePrefix)

const NOINDEX_PATHNAMES = new Set([
  ...LOCALE_PREFIXES.flatMap((prefix) =>
    PAYMENT_STATUSES.map((status) => `${prefix}/payment/${status}`)
  ),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/individual-submission`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/booking-confirmation`),
  ...LOCALE_PREFIXES.map((prefix) => `${prefix}/agent`),
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
