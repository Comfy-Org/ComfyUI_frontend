/**
 * hreflang alternates for the en <-> zh-CN pair.
 *
 * The site has had no hreflang at all, so the two language versions are
 * unrelated as far as a search engine is concerned even though /zh-CN/ ranks on
 * its own. The rule that matters while fixing that: never advertise a URL that
 * does not exist. Roughly a sixth of the English pages have no Chinese twin, and
 * a cluster that references a 404 is worse than no cluster.
 *
 * So the twin set is derived from the page tree itself rather than a hand list,
 * because hand lists are exactly what drifts when someone adds a page.
 */

/** The value both properties use for Simplified Chinese. The hub emits it for
 *  its /zh/ URLs, so the two clusters describe one language, not two. URLs are
 *  untouched: this is a label, not a path. */
export const ZH_HREFLANG = 'zh-Hans'
export const ZH_PREFIX = '/zh-CN'

export interface Alternate {
  hreflang: string
  href: string
}

/** Page files, from both trees, as Vite sees them at build time. */
const PAGE_FILES = import.meta.glob('/src/pages/**/*.astro', { eager: false })

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
 * is not guaranteed to build in Chinese, and the file tree cannot see that. Those
 * pages pass their own alternates instead (see `alternatesFor`).
 */
export function mirroredRoutes(files: string[] = Object.keys(PAGE_FILES)): Set<string> {
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

  // 404 is served, not linked, and must never appear in a language cluster.
  english.delete('/404/')
  return new Set([...english].filter((route) => chinese.has(route)))
}

const MIRRORED = mirroredRoutes()

/** The path with any locale prefix removed, always with a trailing slash. */
export function unprefixed(pathname: string): string {
  const path = pathname.startsWith(ZH_PREFIX)
    ? pathname.slice(ZH_PREFIX.length) || '/'
    : pathname
  return path.endsWith('/') ? path : `${path}/`
}

/**
 * The alternates for a page, or an empty list when it has no twin.
 *
 * `hasTwin` lets a dynamic route answer for itself, since only it knows whether
 * its slug exists in the other locale. Left undefined, the page tree decides.
 */
export function alternatesFor(
  pathname: string,
  siteUrl: string,
  options: { hasTwin?: boolean; mirrored?: Set<string> } = {}
): Alternate[] {
  const { hasTwin, mirrored = MIRRORED } = options
  const path = unprefixed(pathname)
  const twinExists = hasTwin ?? mirrored.has(path)
  if (!twinExists) return []

  const origin = siteUrl.replace(/\/$/, '')
  const englishHref = `${origin}${path}`
  const chineseHref = `${origin}${ZH_PREFIX}${path === '/' ? '/' : path}`

  return [
    { hreflang: 'en', href: englishHref },
    { hreflang: ZH_HREFLANG, href: chineseHref },
    // x-default points at English: it is what a reader with no matching
    // language preference should get.
    { hreflang: 'x-default', href: englishHref },
  ]
}

/** OG wants underscored locale identifiers, not the BCP 47 tags used elsewhere. */
export function ogLocale(locale: string): string {
  return locale === 'zh-CN' ? 'zh_CN' : 'en_US'
}

/** The OG identifier for the other language, when this page has one. */
export function ogLocaleAlternate(locale: string, alternates: Alternate[]): string | null {
  if (alternates.length === 0) return null
  return locale === 'zh-CN' ? 'en_US' : 'zh_CN'
}
