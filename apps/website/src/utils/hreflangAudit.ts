/**
 * The rules `scripts/check-hreflang.ts` enforces against the built site.
 *
 * Separated from the crawler so they can be tested against fixtures rather than
 * a full build. A guard nobody has watched fail is not a guard, and two of these
 * rules exist because the first version of the crawler passed a broken cluster.
 */
import type { Alternate } from './hreflangRoutes'

import { isExcludedFromSitemap } from '../config/indexing'
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  LOCALES,
  localeHasRoute
} from '../config/locales'
import { redirects } from '../config/redirects'
import { isLocaleInvariantPath } from '../config/routes'
import { unprefixed } from './hreflangRoutes'

export interface BuiltSite {
  /** Every built route, mapped to the alternates its HTML emits. */
  pages: Map<string, Alternate[]>
  /** Missing route keys mean no canonical link was extracted. */
  canonicals: ReadonlyMap<string, string>
  /**
   * Sitemap URL -> the alternates it advertises, in document order. `null` when
   * the sitemap is absent.
   *
   * Deliberately the full pairs rather than a set of language names: comparing
   * names alone accepts a sitemap whose `zh-CN` link points at the English URL,
   * which is the same lie the page-side rules already refuse.
   */
  sitemap: Map<string, Alternate[]> | null
  origin: string
}

/**
 * The exact locale-to-URL mapping a clustered route must emit.
 *
 * Required locales come from policy; built pages also expose extra publication.
 */
function expectedAlternates(
  route: string,
  origin: string,
  pages: ReadonlyMap<string, Alternate[]>
): Map<string, string> {
  const path = unprefixed(route)
  const publishedLocales = LOCALE_CODES.filter(
    (locale) =>
      localeHasRoute(locale, path) ||
      pages.has(`${LOCALES[locale].prefix}${path}`)
  )
  const expected = new Map<string, string>(
    publishedLocales.map((locale): [string, string] => [
      LOCALES[locale].hreflang,
      new URL(`${LOCALES[locale].prefix}${path}`, origin).href
    ])
  )
  expected.set(
    'x-default',
    new URL(`${LOCALES[DEFAULT_LOCALE].prefix}${path}`, origin).href
  )
  return expected
}

function isClustered(
  route: string,
  alternates: Alternate[],
  origin: string
): boolean {
  const path = unprefixed(route)
  // Observed links still get audited on exempt routes, and crawlable pages
  // cannot evade the audit by omitting every link.
  return (
    alternates.length > 0 ||
    (path !== '/404.html' &&
      !isLocaleInvariantPath(path) &&
      !isExcludedFromSitemap(`${origin}${route}`) &&
      !Object.hasOwn(redirects, route.replace(/\/$/, '')))
  )
}

/**
 * The rules a cluster must satisfy wherever it is declared.
 *
 * Applied to the page tags AND to the sitemap entries, because a cluster is
 * only as good as its weaker declaration: a sitemap naming the right languages
 * while pointing `zh-CN` at the English URL misdescribes the site exactly as
 * a page doing the same would.
 */
function clusterErrors(
  route: string,
  alternates: Alternate[],
  origin: string,
  source: string,
  pages: ReadonlyMap<string, Alternate[]>
): string[] {
  const errors: string[] = []
  const expected = expectedAlternates(route, origin, pages)
  const seen = new Set<string>()
  for (const { hreflang, href } of alternates) {
    if (seen.has(hreflang)) {
      errors.push(
        `${route}: ${source} declares hreflang="${hreflang}" more than once`
      )
    }
    seen.add(hreflang)

    if (!expected.has(hreflang)) {
      errors.push(
        `${route}: ${source} declares hreflang="${hreflang}", which is not one of ${[...expected.keys()].join(', ')}`
      )
    }

    if (!href.startsWith(origin)) {
      errors.push(
        `${route}: ${source} alternate ${hreflang} points off-origin (${href})`
      )
    }
  }

  // Reciprocity alone accepts a cluster whose two locales are swapped: each
  // side still lists the other, so every link resolves while the labels lie.
  if (isClustered(route, alternates, origin)) {
    for (const [hreflang, href] of expected) {
      if (
        !alternates.some(
          (entry) => entry.hreflang === hreflang && entry.href === href
        )
      ) {
        errors.push(
          `${route}: ${source} expects ${hreflang} -> ${href}, but does not declare it`
        )
      }
    }
  }
  return errors
}

export function routeOfHref(href: string, origin: string): string {
  const route = href.slice(origin.length) || '/'
  try {
    return decodeURI(route)
  } catch {
    return route
  }
}

function pageErrors(
  pages: ReadonlyMap<string, Alternate[]>,
  canonicals: ReadonlyMap<string, string>,
  origin: string
): string[] {
  const errors: string[] = []
  for (const [route, alternates] of pages) {
    if (isClustered(route, alternates, origin)) {
      const expectedCanonical = new URL(route, origin).href
      if (canonicals.get(route) !== expectedCanonical) {
        errors.push(`${route}: canonical must be ${expectedCanonical}`)
      }
    }
    errors.push(...clusterErrors(route, alternates, origin, 'page', pages))

    // Only the pages can be checked against what was actually built.
    for (const { hreflang, href } of alternates) {
      if (!href.startsWith(origin)) continue
      const target = routeOfHref(href, origin)
      if (!pages.has(target)) {
        errors.push(
          `${route}: alternate ${hreflang} -> ${target} was not built (404)`
        )
      }
    }
  }
  return errors
}

function reciprocityErrors(
  pages: ReadonlyMap<string, Alternate[]>,
  origin: string
): string[] {
  const errors: string[] = []
  // Reciprocity: if A lists B, B must list A. A one-way cluster is discarded.
  for (const [route, alternates] of pages) {
    for (const { hreflang, href } of alternates) {
      if (hreflang === 'x-default') continue
      const target = routeOfHref(href, origin)
      if (target === route) continue
      const back = pages.get(target)
      if (!back) continue // already reported as unbuilt
      if (!back.some((entry) => routeOfHref(entry.href, origin) === route)) {
        errors.push(`${route}: lists ${target}, which does not list it back`)
      }
    }
  }
  return errors
}

function missingSitemapClusters(
  pages: ReadonlyMap<string, Alternate[]>,
  sitemap: ReadonlyMap<string, Alternate[]>,
  origin: string
): string[] {
  const errors: string[] = []
  // Comparing only the sitemap's own entries never sees a clustered page the
  // sitemap leaves out, which is the direction this actually drifted.
  for (const [route, alternates] of pages) {
    if (isClustered(route, alternates, origin) && !sitemap.has(route)) {
      errors.push(`${route}: language cluster missing from sitemap`)
    }
  }
  return errors
}

function sitemapEntryErrors(
  pages: ReadonlyMap<string, Alternate[]>,
  sitemap: ReadonlyMap<string, Alternate[]>,
  origin: string
): string[] {
  const errors: string[] = []
  for (const [route, sitemapAlternates] of sitemap) {
    // A sitemap URL with no page behind it is a 404 offered to a crawler. Report
    // that and stop: the language comparison below would otherwise diff against
    // an empty page cluster and blame the alternates for a missing page.
    if (!pages.has(route)) {
      errors.push(`${route}: the sitemap lists it, but it was not built (404)`)
      continue
    }

    errors.push(
      ...clusterErrors(route, sitemapAlternates, origin, 'sitemap', pages)
    )

    const langs = new Set(
      sitemapAlternates.map((alternate) => alternate.hreflang)
    )
    const onPage = new Set(
      (pages.get(route) ?? []).map((alternate) => alternate.hreflang)
    )
    const sitemapOnly = [...langs].filter((lang) => !onPage.has(lang))
    const pageOnly = [...onPage].filter((lang) => !langs.has(lang))
    if (sitemapOnly.length > 0) {
      errors.push(
        `${route}: sitemap advertises ${sitemapOnly.join(', ')} that the page does not`
      )
    }
    if (pageOnly.length > 0) {
      errors.push(
        `${route}: page advertises ${pageOnly.join(', ')} that the sitemap does not`
      )
    }
  }

  return errors
}

export function auditBuiltSite({
  pages,
  canonicals,
  sitemap,
  origin
}: BuiltSite): string[] {
  const errors = [
    ...pageErrors(pages, canonicals, origin),
    ...reciprocityErrors(pages, origin)
  ]
  if (!sitemap) {
    return [
      ...errors,
      'sitemap-0.xml is missing, so its alternates cannot be checked'
    ]
  }
  return [
    ...errors,
    ...missingSitemapClusters(pages, sitemap, origin),
    ...sitemapEntryErrors(pages, sitemap, origin)
  ]
}

/**
 * The sitemap chunk filenames a sitemap index names.
 *
 * `@astrojs/sitemap` chunks at 45k URLs. Reading only `sitemap-0.xml` is correct
 * at today's ~600 pages, but the moment a second chunk exists every route inside
 * it would be reported as "language cluster missing from sitemap", which
 * names the wrong problem entirely. The index is the only thing that knows how
 * many chunks there are.
 *
 * Only this site's own chunks are returned. The published index also lists
 * `sitemap-workflows-0.xml`, which a different app builds and which is not in
 * this dist, so counting it would report every hub URL as an unbuilt page.
 */
export function sitemapChunkNames(indexXml: string): string[] {
  return [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1].trim().split('/').pop() ?? '')
    .filter((name) => /^sitemap-\d+\.xml$/.test(name))
}
