/**
 * The route model `hreflangAudit.ts` checks the built site against, and the
 * page-tree oracle `hreflang.test.ts` checks the emitter's route list against.
 *
 * Deliberately NOT the production builder. `src/lib/hreflang.ts` decides what a
 * page emits; this restates the rule from the file tree independently, so a
 * defect in the emitter is caught rather than mirrored by its own checker.
 * Kept free of `import.meta.glob` so a plain Node script can import it.
 */

/** The value the marketing site publishes for Simplified Chinese. */
export const ZH_HREFLANG = 'zh-CN'
export const ZH_PREFIX = '/zh-CN'

/**
 * `/src/pages/cloud/pricing.astro` -> `/cloud/pricing/`, index files -> their directory.
 *
 * Exported so a caller asking "which route is this file?" derives it here rather
 * than inlining the mapping. A near-enough second copy asked about
 * `/legal/index/`, a route no cluster can contain, so every `index.astro`
 * passed its membership check vacuously.
 */
export function routeOf(file: string): string {
  const withoutRoot = file.replace(/^\/src\/pages/, '').replace(/\.astro$/, '')
  const withoutIndex = withoutRoot.replace(/\/index$/, '')
  return withoutIndex === '' ? '/' : `${withoutIndex}/`
}

export interface Alternate {
  hreflang: string
  href: string
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
