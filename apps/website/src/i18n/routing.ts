import type { Locale } from './locales'

import { DEFAULT_LOCALE, LOCALES } from './locales'

// A single `getStaticPaths` entry for a locale route. The default locale carries
// an `undefined` rest-param segment so Astro emits the unprefixed root route
// (`/gallery`); every other locale carries its prefix (`/zh-CN/gallery`).
interface LocalePathEntry {
  params: { locale: Locale | undefined }
}

// Enumerate one route per locale for a `[...locale]/<page>.astro` file to feed to
// `getStaticPaths`. Derived from LOCALES, so adding a locale lights up every
// locale route automatically.
export function localePaths(): LocalePathEntry[] {
  return LOCALES.map((locale) => ({
    params: { locale: locale === DEFAULT_LOCALE ? undefined : locale }
  }))
}
