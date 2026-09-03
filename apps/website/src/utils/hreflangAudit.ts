/**
 * The rules `scripts/check-hreflang.ts` enforces against the built site.
 *
 * Separated from the crawler so they can be tested against fixtures rather than
 * a full build. A guard nobody has watched fail is not a guard, and two of these
 * rules exist because the first version of the crawler passed a broken cluster.
 */
import type { Alternate } from './hreflangRoutes'

import {
  JA_HREFLANG,
  JA_PREFIX,
  localizedHref,
  unprefixed,
  ZH_HREFLANG,
  ZH_PREFIX
} from './hreflangRoutes'

export interface BuiltSite {
  /** Every built route, mapped to the alternates its HTML emits. */
  pages: Map<string, Alternate[]>
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
 * Derived from the same prefix rule the pages and the sitemap use, so there is
 * one definition of what the Chinese twin of a URL is.
 */
function expectedAlternates(
  route: string,
  origin: string,
  builtRoutes: ReadonlySet<string>
): Map<string, string> {
  const path = unprefixed(route)
  const english = `${origin}${path}`
  const chinese = `${origin}${localizedHref(ZH_PREFIX, path)}`
  const japaneseRoute = localizedHref(JA_PREFIX, path)

  const expected = new Map([
    ['en', english],
    [ZH_HREFLANG, chinese]
  ])
  // Japanese is a partial locale: it has one page today, so it belongs in a
  // cluster only where its page was actually built. Deciding that from the BUILT
  // site rather than from the emitter's own route list is what keeps this an
  // independent check. A stale list fails here both ways round: claim a Japanese
  // page that was not built and the "was not built (404)" rule fires; build one
  // and forget to list it and the "expects ja -> ... but does not declare it"
  // rule fires.
  if (builtRoutes.has(japaneseRoute)) {
    expected.set(JA_HREFLANG, `${origin}${japaneseRoute}`)
  }
  expected.set('x-default', english)
  return expected
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
  builtRoutes: ReadonlySet<string>
): string[] {
  const errors: string[] = []
  const expected = expectedAlternates(route, origin, builtRoutes)
  const seen = new Set<string>()
  for (const { hreflang, href } of alternates) {
    if (seen.has(hreflang)) {
      errors.push(
        `${route}: ${source} declares hreflang="${hreflang}" more than once`
      )
    }
    seen.add(hreflang)

    // Checking only that the expected pairs are present accepts extras beside
    // them. A locale this site does not publish still resolves and can still be
    // reciprocal, so nothing downstream catches it. The set stays closed: `ja`
    // is admitted above only for a route whose Japanese page was actually
    // built, so a cluster naming `ja` on any other route is still rejected.
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
  if (alternates.length > 0) {
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

export function auditBuiltSite({
  pages,
  sitemap,
  origin
}: BuiltSite): string[] {
  const errors: string[] = []
  const routeOfHref = (href: string) => href.slice(origin.length) || '/'
  // Which locales a route SHOULD cluster is read off the built site, so the
  // audit never inherits the emitter's opinion of what exists.
  const builtRoutes: ReadonlySet<string> = new Set(pages.keys())

  for (const [route, alternates] of pages) {
    errors.push(
      ...clusterErrors(route, alternates, origin, 'page', builtRoutes)
    )

    // Only the pages can be checked against what was actually built.
    for (const { hreflang, href } of alternates) {
      if (!href.startsWith(origin)) continue
      const target = routeOfHref(href)
      if (!pages.has(target)) {
        errors.push(
          `${route}: alternate ${hreflang} -> ${target} was not built (404)`
        )
      }
    }
  }

  // Reciprocity: if A lists B, B must list A. A one-way cluster is discarded.
  for (const [route, alternates] of pages) {
    for (const { hreflang, href } of alternates) {
      if (hreflang === 'x-default') continue
      const target = routeOfHref(href)
      if (target === route) continue
      const back = pages.get(target)
      if (!back) continue // already reported as unbuilt
      if (!back.some((entry) => routeOfHref(entry.href) === route)) {
        errors.push(`${route}: lists ${target}, which does not list it back`)
      }
    }
  }

  if (!sitemap) {
    errors.push('sitemap-0.xml is missing, so its alternates cannot be checked')
    return errors
  }

  // Comparing only the sitemap's own entries never sees a clustered page the
  // sitemap leaves out, which is the direction this actually drifted.
  for (const [route, alternates] of pages) {
    if (alternates.length > 0 && !sitemap.has(route)) {
      errors.push(`${route}: advertises alternates but the sitemap omits it`)
    }
  }

  for (const [route, sitemapAlternates] of sitemap) {
    // A sitemap URL with no page behind it is a 404 offered to a crawler. Report
    // that and stop: the language comparison below would otherwise diff against
    // an empty page cluster and blame the alternates for a missing page.
    if (!pages.has(route)) {
      errors.push(`${route}: the sitemap lists it, but it was not built (404)`)
      continue
    }

    errors.push(
      ...clusterErrors(route, sitemapAlternates, origin, 'sitemap', builtRoutes)
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

/**
 * The sitemap chunk filenames a sitemap index names.
 *
 * `@astrojs/sitemap` chunks at 45k URLs. Reading only `sitemap-0.xml` is correct
 * at today's ~600 pages, but the moment a second chunk exists every route inside
 * it would be reported as "advertises alternates but the sitemap omits it", which
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
