/**
 * Which routes exist in both locales, and how a page file maps to a route.
 *
 * Kept free of `import.meta.glob` so `astro.config.ts` can apply the same rule to
 * sitemap alternates that the pages apply to their link tags. One definition of
 * "this page has a twin", two consumers, so the sitemap and the markup cannot
 * disagree about which pages are in the cluster.
 */

/** The value both properties use for Simplified Chinese. The hub emits it for
 *  its /zh/ URLs, so the two clusters describe one language, not two. URLs are
 *  untouched: this is a label, not a path. */
export const ZH_HREFLANG = 'zh-Hans'
export const ZH_PREFIX = '/zh-CN'

/**
 * Routes kept out of the cluster even when both locales have them.
 *
 * These are the transactional pages the sitemap already excludes. Telling a
 * search engine that two pages are translations of each other, while telling it
 * elsewhere not to index either, is a contradiction; keeping one list means the
 * markup and the sitemap cannot drift apart on it.
 */
const NON_CLUSTERED_ROUTES: ReadonlySet<string> = new Set([
  '/404/',
  '/payment/success/',
  '/payment/failed/',
  '/individual-submission/',
  '/booking-confirmation/'
])

/** `/src/pages/cloud/pricing.astro` -> `/cloud/pricing/`, index files -> their directory. */
function routeOf(file: string): string {
  const withoutRoot = file.replace(/^\/src\/pages/, '').replace(/\.astro$/, '')
  const withoutIndex = withoutRoot.replace(/\/index$/, '')
  return withoutIndex === '' ? '/' : `${withoutIndex}/`
}

/**
 * Un-prefixed routes that exist in BOTH locales.
 *
 * Dynamic routes are excluded even when the file exists in both trees: the two
 * `getStaticPaths` read their own locale's content, so a slug present in English
 * is not guaranteed to build in Chinese, and the file tree cannot see that.
 */
export function mirroredRoutes(files: string[]): Set<string> {
  const english = new Set<string>()
  const chinese = new Set<string>()

  for (const file of files) {
    if (file.includes('[')) continue
    const route = routeOf(file)
    if (route.startsWith(`${ZH_PREFIX}/`) || route === `${ZH_PREFIX}/`) {
      chinese.add(route.slice(ZH_PREFIX.length) || '/')
    } else {
      english.add(route)
    }
  }

  return new Set(
    [...english].filter(
      (route) => chinese.has(route) && !NON_CLUSTERED_ROUTES.has(route)
    )
  )
}

/** The path with any locale prefix removed, always with a trailing slash. */
export function unprefixed(pathname: string): string {
  const path = pathname.startsWith(ZH_PREFIX)
    ? pathname.slice(ZH_PREFIX.length) || '/'
    : pathname
  return path.endsWith('/') ? path : `${path}/`
}
