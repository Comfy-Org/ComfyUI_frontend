export const SUPPORTED_LOCALES = ['en', 'zh-CN', 'ja'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE = 'en' satisfies Locale
