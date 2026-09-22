/**
 * Route helpers shared by the page-tree oracle and built-site audit.
 * The oracle derives published routes from Astro files independently of
 * `localeHasRoute`. The audit checks built pages against both publication
 * policy and emitted links. Both use the configured locale prefixes.
 * Kept free of `import.meta.glob` so a plain Node script can import it.
 */

import { NON_DEFAULT_LOCALE_PREFIXES } from '../config/locales'

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
  for (const prefix of NON_DEFAULT_LOCALE_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const path = pathname.slice(prefix.length) || '/'
      return path.endsWith('/') ? path : `${path}/`
    }
  }
  return pathname.endsWith('/') ? pathname : `${pathname}/`
}
