// The canonical list of locales the site is published in. This is the single
// source of truth: astro.config.ts (i18n routing + sitemap), translations.ts
// (the `Locale` type), and the locale-routing helpers all derive from it, so
// adding a locale is a one-line edit here.
export const LOCALES = ['en', 'zh-CN'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

// Narrow an untrusted locale candidate (a route param, Astro.currentLocale) to a
// known Locale, falling back to the default. Keeps LOCALES the single source of
// truth instead of scattering `=== 'zh-CN'` checks or unchecked `as Locale` casts.
export function toLocale(value: string | undefined): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE
}
