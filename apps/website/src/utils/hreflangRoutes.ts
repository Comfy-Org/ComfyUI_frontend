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

export interface Alternate {
  hreflang: string
  href: string
}

/**
 * The alternates a clustered route advertises, in the order they are emitted.
 *
 * The ONE definition of what a cluster looks like in production. The page tags
 * and the sitemap both render this, so they cannot disagree about the shape the
 * way they could while each assembled the triple itself. The audit deliberately
 * keeps its own expectation (`hreflangAudit.ts`), so a defect here is still
 * caught rather than mirrored by its own checker.
 *
 * @param path An un-prefixed route, i.e. the output of `unprefixed`.
 */
export function clusterAlternates(path: string, origin: string): Alternate[] {
  const english = `${origin}${path}`
  const chinese = `${origin}${ZH_PREFIX}${path === '/' ? '/' : path}`

  return [
    { hreflang: 'en', href: english },
    { hreflang: ZH_HREFLANG, href: chinese },
    // x-default points at English: it is what a reader with no matching
    // language preference should get.
    { hreflang: 'x-default', href: english }
  ]
}

/**
 * The path with any locale prefix removed, always with a trailing slash.
 *
 * The prefix has to be a whole segment. A bare `startsWith` also matches a route
 * like `/zh-CN-guide/`, which would be stripped to `-guide/` and clustered with
 * whatever page happens to own that path.
 */
export function unprefixed(pathname: string): string {
  const isLocalePrefixed =
    pathname === ZH_PREFIX || pathname.startsWith(`${ZH_PREFIX}/`)
  const path = isLocalePrefixed
    ? pathname.slice(ZH_PREFIX.length) || '/'
    : pathname
  return path.endsWith('/') ? path : `${path}/`
}
