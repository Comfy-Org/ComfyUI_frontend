/**
 * The single source of truth for the locales this site serves.
 *
 * Before this file the answer to "what locales exist?" was written down in six
 * places that did not agree, and adding Japanese missed two of them: the
 * indexing policy never learned about `ja`, and the hreflang builder read `/ja/`
 * as an English route. Everything locale-shaped now derives from `LOCALES`.
 *
 * Kept free of imports so `astro.config.ts` can read it at build time and so it
 * can never form an import cycle with `routes.ts` or `hreflang.ts`, both of
 * which depend on it.
 */

export interface LocaleConfig {
  /** BCP 47 tag. Also the key this locale is stored under. */
  code: string
  /**
   * URL prefix, empty for the default locale.
   *
   * Japanese uses the short `/ja` while Chinese keeps the legacy `/zh-CN`. The
   * asymmetry is historical rather than designed, and is preserved on purpose:
   * the Chinese URLs rank, and a migration would risk that for no SEO gain.
   * See `context/decision-zh-hreflang-value.md`.
   */
  prefix: string
  /** The value published in `hreflang` and `<html lang>`. */
  hreflang: string
  /** Open Graph wants `language_TERRITORY`, not the BCP 47 tag. */
  ogLocale: string
  /** English name, for internal listings. */
  name: string
  /** Endonym, for the language switcher. */
  nativeName: string
  /** Writing direction. Arabic (CRE-584) will be the first `rtl`. */
  dir: 'ltr' | 'rtl'
}

export const DEFAULT_LOCALE = 'en'

/**
 * Adding a locale here is a compile error until every field is supplied, and
 * `locales.test.ts` plus the dependent sites' own tests fail until each of them
 * widens too. That is the guard whose absence let `ja` ship half-wired.
 */
export const LOCALES = {
  en: {
    code: 'en',
    prefix: '',
    hreflang: 'en',
    ogLocale: 'en_US',
    name: 'English',
    nativeName: 'English',
    dir: 'ltr'
  },
  'zh-CN': {
    code: 'zh-CN',
    prefix: '/zh-CN',
    hreflang: 'zh-CN',
    ogLocale: 'zh_CN',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    dir: 'ltr'
  },
  ja: {
    code: 'ja',
    prefix: '/ja',
    hreflang: 'ja',
    ogLocale: 'ja_JP',
    name: 'Japanese',
    nativeName: '日本語',
    dir: 'ltr'
  }
} as const satisfies Record<string, LocaleConfig>

export type Locale = keyof typeof LOCALES

/** Declaration order, which is also the order clusters and switchers list. */
export const LOCALE_CODES = Object.keys(LOCALES) as Locale[]

/** Non-default locales, i.e. the ones that carry a URL prefix. */
export const LOCALIZED_CODES = LOCALE_CODES.filter(
  (code) => code !== DEFAULT_LOCALE
)

/** Every URL prefix that identifies a locale, default excluded. */
export const LOCALE_PREFIXES = LOCALIZED_CODES.map(
  (code) => LOCALES[code].prefix
)

export function localePrefix(locale: Locale): string {
  return LOCALES[locale].prefix
}

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && value in LOCALES
}

/**
 * Routes a partially-translated locale actually serves.
 *
 * Chinese is absent because it has a twin for nearly every route, so it gets a
 * blanket yes and `LOCALE_INVARIANT_PATHS` carves out the exceptions. Japanese
 * is the other way round: one page today, so the same blanket rule would offer
 * around 58 Japanese URLs that do not exist.
 *
 * P3 generates the Japanese page shells and generates this set with them, at
 * which point `ja` moves to the blanket rule and this entry disappears.
 *
 * Paths carry no trailing slash, matching `baseRoutes` and `englishPath`.
 */
const PARTIAL_LOCALE_ROUTES: Partial<Record<Locale, ReadonlySet<string>>> = {
  ja: new Set(['/'])
}

/**
 * Whether `route` (an English path) is served in `locale`.
 *
 * Consumed by the hreflang builder, so a cluster never names a page that does
 * not exist, and by `localizeHref`, so a link never points at one either. Those
 * two used to disagree, which is how `/ja/` came to advertise `/zh-CN/ja/`.
 */
export function localeHasRoute(locale: Locale, route: string): boolean {
  if (locale === DEFAULT_LOCALE) return true
  const served = PARTIAL_LOCALE_ROUTES[locale]
  return served === undefined || served.has(route)
}

/**
 * Which localized pages may be indexed.
 *
 * Deliberately an explicit list rather than something computed from how much of
 * a page is translated. Completeness is only known after a page renders, but its
 * hreflang tags are written before that, so a computed gate would let the tags
 * and the sitemap disagree, which is the defect Phase 0 fixed. An allowlist is
 * known up front, so every surface reads the same answer.
 *
 * It also matches how the hub works: a locale goes live in its own small,
 * reviewed change rather than by a heuristic deciding on someone's behalf.
 *
 * `pnpm i18n:report` says which namespaces are complete enough to add here.
 */
const INDEXABLE_PAGES: Record<
  Exclude<Locale, typeof DEFAULT_LOCALE>,
  'all' | ReadonlySet<string>
> = {
  // Complete and human-approved, so every page it serves is fair game.
  'zh-CN': 'all',
  // Japanese has one page today and it is already indexed; whether a
  // 94%-English page should stay that way was deferred to P4, so this holds the
  // current behaviour rather than silently changing it. When P3 generates the
  // shells this narrows to the tier-1 pages the plan wants launched first.
  ja: 'all'
}

/** Whether `route` may be indexed in `locale`. English is always indexable. */
export function isPageIndexable(locale: Locale, route: string): boolean {
  if (locale === DEFAULT_LOCALE) return true
  if (!localeHasRoute(locale, route)) return false
  const allowed = INDEXABLE_PAGES[locale]
  return allowed === 'all' || allowed.has(route)
}
