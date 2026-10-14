import { isProductionBuild } from '@/config/build-env'
import type { Locale } from '@/i18n/translations'

const CHALLENGE_LOCALES = ['en', 'zh-CN'] as const satisfies readonly Locale[]

/** Preview-only routes for the challenge page; production builds get none. */
export function challengeStaticPaths() {
  if (isProductionBuild()) return []
  return CHALLENGE_LOCALES.map((locale) => ({
    params: { locale: locale === 'en' ? undefined : locale, view: undefined },
    props: { locale }
  }))
}
