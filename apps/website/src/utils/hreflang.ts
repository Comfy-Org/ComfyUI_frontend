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
import type { Alternate } from './hreflangRoutes'

import { clusterAlternates, mirroredRoutes, unprefixed } from './hreflangRoutes'

export type { Alternate }

/** Page files, from both trees, as Vite sees them at build time. */
const PAGE_FILES = import.meta.glob('/src/pages/**/*.astro', { eager: false })

const MIRRORED = mirroredRoutes(Object.keys(PAGE_FILES))

/**
 * The alternates for a page, or an empty list when it has no twin.
 *
 * Whether a twin exists is decided by the page tree alone. A page cannot assert
 * it: a claim with nothing behind it is how a cluster ends up advertising a 404.
 */
export function alternatesFor(
  pathname: string,
  siteUrl: string,
  options: { mirrored?: Set<string> } = {}
): Alternate[] {
  const { mirrored = MIRRORED } = options
  const path = unprefixed(pathname)
  if (!mirrored.has(path)) return []

  return clusterAlternates(path, siteUrl.replace(/\/$/, ''))
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
