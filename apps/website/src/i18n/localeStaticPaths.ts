import type { GetStaticPathsOptions } from 'astro'

import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  LOCALES,
  normalizeRoute
} from '@/config/locales'
import { supportsLocaleRoute } from '@/config/routes'
import { routeOf } from '@/utils/hreflangRoutes'

const LOCALE_DIR = '[...locale]'
const LOCALE_SEGMENT = `/${LOCALE_DIR}`

/**
 * `getStaticPaths` for a page under `src/pages/[...locale]/`: the English page
 * at the bare path, plus a prefixed copy for every locale that publishes it.
 */
export function localeStaticPaths({
  routePattern
}: Pick<GetStaticPathsOptions, 'routePattern'>) {
  if (!routePattern.startsWith(LOCALE_SEGMENT)) {
    throw new Error(
      `localeStaticPaths only serves pages under src/pages/${LOCALE_DIR}/, not ${routePattern}`
    )
  }
  const route = routePattern.slice(LOCALE_SEGMENT.length) || '/'
  return LOCALE_CODES.filter(
    (locale) => locale === DEFAULT_LOCALE || supportsLocaleRoute(locale, route)
  ).map((locale) => ({
    params: { locale: LOCALES[locale].prefix.slice(1) || undefined }
  }))
}

/**
 * The page files a file under `src/pages/` serves, relative to that directory:
 * `[...locale]/about.astro` serves `about.astro` and `zh-CN/about.astro`.
 * Any other file serves itself.
 */
export function localePageFiles(file: string): string[] {
  if (!file.startsWith(`${LOCALE_DIR}/`)) return [file]
  const page = file.slice(LOCALE_DIR.length + 1)
  const route = normalizeRoute(routeOf(`/src/pages/${page}`))
  return localeStaticPaths({ routePattern: `${LOCALE_SEGMENT}${route}` }).map(
    ({ params }) => (params.locale ? `${params.locale}/${page}` : page)
  )
}
