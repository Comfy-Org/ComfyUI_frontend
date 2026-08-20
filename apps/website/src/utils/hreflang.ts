/**
 * hreflang alternates for the en <-> zh-CN pair.
 *
 * The site has had no hreflang at all, so the two language versions are
 * unrelated as far as a search engine is concerned even though /zh-CN/ ranks on
 * its own. The rule that matters while fixing that: never advertise a URL that
 * does not exist. Roughly a sixth of the English pages have no Chinese twin, and
 * a cluster that references a 404 is worse than no cluster.
 *
 * The twin set comes from the page tree rather than a hand list, because hand
 * lists are exactly what drifts when someone adds a page. `hreflangRoutes.ts`
 * holds that rule so the sitemap can apply the identical one.
 */
import {
  mirroredRoutes,
  unprefixed,
  ZH_HREFLANG,
  ZH_PREFIX
} from './hreflangRoutes'

export { ZH_HREFLANG, ZH_PREFIX } from './hreflangRoutes'

export interface Alternate {
  hreflang: string
  href: string
}

/** Page files, from both trees, as Vite sees them at build time. */
const PAGE_FILES = import.meta.glob('/src/pages/**/*.astro', { eager: false })

const MIRRORED = mirroredRoutes(Object.keys(PAGE_FILES))

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
    { hreflang: 'x-default', href: englishHref }
  ]
}

/** OG wants underscored locale identifiers, not the BCP 47 tags used elsewhere. */
export function ogLocale(locale: string): string {
  return locale === 'zh-CN' ? 'zh_CN' : 'en_US'
}

/** The OG identifier for the other language, when this page has one. */
export function ogLocaleAlternate(
  locale: string,
  alternates: Alternate[]
): string | null {
  if (alternates.length === 0) return null
  return locale === 'zh-CN' ? 'en_US' : 'zh_CN'
}
