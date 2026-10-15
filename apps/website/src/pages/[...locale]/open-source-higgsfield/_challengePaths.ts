import type { Locale } from '@/i18n/translations'

const CHALLENGE_LOCALES = ['en', 'zh-CN'] as const satisfies readonly Locale[]

/** English at the root and Chinese under its prefix. */
export function challengeStaticPaths() {
  return CHALLENGE_LOCALES.map((locale) => ({
    params: { locale: locale === 'en' ? undefined : locale, view: undefined },
    props: { locale }
  }))
}
