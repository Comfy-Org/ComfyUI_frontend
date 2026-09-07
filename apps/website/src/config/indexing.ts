import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  isPageIndexable,
  localePrefix
} from './locales'
import type { Locale } from './locales'
import { isLocaleInvariantPath } from './routes'
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

/**
 * The locale a URL belongs to, and the English route underneath it.
 *
 * `/ja/pricing` -> `ja`, `/pricing`. Matched on a whole path segment, so a route
 * that merely starts with a locale's letters is not mistaken for that locale.
 */
function splitLocale(pathname: string): { locale: Locale; route: string } {
  for (const locale of LOCALE_CODES) {
    if (locale === DEFAULT_LOCALE) continue
    const prefix = localePrefix(locale)
    if (pathname === prefix) return { locale, route: '/' }
    if (pathname.startsWith(`${prefix}/`)) {
      return { locale, route: pathname.slice(prefix.length) }
    }
  }
  return { locale: DEFAULT_LOCALE, route: pathname }
}

export function isExcludedFromSitemap(page: string): boolean {
  const pathname = normalizePathname(new URL(page).pathname)
  if (
    NOINDEX_PATHNAMES.has(pathname) ||
    MODEL_REDIRECT_PATHNAMES.has(pathname)
  ) {
    return true
  }

  // Astro's i18n fallback builds a page for every route in a fallback locale,
  // so /ja/ became 560 pages the moment it was enabled. Those pages already
  // canonical to English and leave themselves out of their own hreflang
  // cluster; without this the sitemap advertised them anyway. `isPageIndexable`
  // is the same predicate the hreflang emitter reads, so the two cannot
  // disagree — which is the defect Phase 0 existed to fix.
  const { locale, route } = splitLocale(pathname)
  const englishRoute = route === '' ? '/' : route

  // Astro keeps /404 out of the sitemap itself, but only the exact route. The
  // i18n fallback generates /zh-CN/404 and /ja/404 too, and the Chinese one
  // sailed past both guards: Astro did not recognise it and Chinese is 'all'
  // in INDEXABLE_PAGES.
  //
  // Localized copies only. English /404 is Astro's to handle, and this predicate
  // also decides which pages get a markdown twin — excluding it here would
  // silently delete /404.md, which `markdown-twin.test.ts` pins.
  if (locale !== DEFAULT_LOCALE && englishRoute === '/404') return true

  // A locale-invariant route exists once, in English. Astro's fallback is
  // per-locale with no route granularity, so giving Chinese a fallback in P3-9
  // also mints /zh-CN/p/supported-models/* and the rest; Chinese is 'all' in
  // INDEXABLE_PAGES, so without this they would enter the sitemap and advertise
  // Chinese pages that are English content. hreflang already refuses to cluster
  // them — this is the same answer on this surface.
  if (locale !== DEFAULT_LOCALE && isLocaleInvariantPath(englishRoute)) {
    return true
  }

  return !isPageIndexable(locale, englishRoute)
}
