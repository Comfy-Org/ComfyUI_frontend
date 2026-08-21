// The canonical list of locales the site is published in. This is the single
// source of truth: astro.config.ts (i18n routing + sitemap), translations.ts
// (the `Locale` type), and the locale-routing helpers all derive from it, so
// adding a locale is a one-line edit here.
export const LOCALES = ['en', 'zh-CN'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'
