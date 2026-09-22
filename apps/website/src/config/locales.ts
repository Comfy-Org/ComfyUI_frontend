interface LocaleConfig {
  prefix: string
  hreflang: string
  ogLocale: string
}

export const DEFAULT_LOCALE = 'en'

export const LOCALES = {
  en: {
    prefix: '',
    hreflang: 'en',
    ogLocale: 'en_US'
  },
  'zh-CN': {
    prefix: '/zh-CN',
    hreflang: 'zh-CN',
    ogLocale: 'zh_CN'
  },
  ja: {
    prefix: '/ja',
    hreflang: 'ja',
    ogLocale: 'ja_JP'
  }
} as const satisfies Record<string, LocaleConfig>

export type Locale = keyof typeof LOCALES
export type Hreflang = (typeof LOCALES)[Locale]['hreflang']

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && Object.hasOwn(LOCALES, value)
}

export function resolveLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

export const LOCALE_CODES = Object.keys(LOCALES).filter(isLocale)

export const NON_DEFAULT_LOCALE_PREFIXES = LOCALE_CODES.filter(
  (code) => code !== DEFAULT_LOCALE
).map((code) => LOCALES[code].prefix)

function normalizeRoute(route: string): string {
  return route.replace(/\/+$/, '') || '/'
}

const PARTIAL_LOCALE_ROUTES: Partial<Record<Locale, ReadonlySet<string>>> = {
  ja: new Set(['/'].map(normalizeRoute))
}

export function localeHasRoute(locale: Locale, route: string): boolean {
  const served = PARTIAL_LOCALE_ROUTES[locale]
  return served === undefined || served.has(normalizeRoute(route))
}
