import type { ButtonVariants } from '../components/ui/button'
import type { Locale, TranslationKey } from '../i18n/translations'

import { t } from '../i18n/translations'
import { resolveRel } from '../utils/cta'
import { localizeHref } from './routes'

// The banner "CMS": a single typed config resolved through i18n at build time.
// `isActive` is the master on/off switch (supersedes the old SHOW_ANNOUNCEMENT_BANNER).
// NOTE: on this static site, `startsAt`/`endsAt` are evaluated at BUILD time — the
// window gates on the last deploy, not the visitor's exact clock.

interface BannerLinkConfig {
  readonly href: string
  readonly titleKey: TranslationKey
  readonly target?: boolean
  readonly buttonVariant?: NonNullable<ButtonVariants['variant']>
}

export interface BannerConfig {
  readonly id: string
  readonly isActive: boolean
  readonly startsAt?: string
  readonly endsAt?: string
  /** Empty/undefined = all locales. */
  readonly targetLocales?: readonly Locale[]
  /** v1 only supports 'sitewide'. */
  readonly targetSections?: readonly string[]
  readonly titleKey: TranslationKey
  readonly descriptionKey?: TranslationKey
  readonly link?: BannerLinkConfig
}

interface BannerLinkData {
  readonly href: string
  readonly title: string
  readonly target?: '_blank'
  readonly rel?: string
  readonly buttonVariant?: NonNullable<ButtonVariants['variant']>
}

export interface BannerData {
  readonly id: string
  readonly title: string
  readonly description?: string
  readonly link?: BannerLinkData
}

export const bannerConfig: BannerConfig = {
  id: 'announcement',
  isActive: true,
  targetSections: ['sitewide'],
  titleKey: 'launches.banner.text',
  link: {
    href: '/mcp',
    titleKey: 'launches.banner.cta',
    buttonVariant: 'underlineLink'
  }
}

/** Resolve a config's i18n keys into display strings for the given locale. */
export function getBannerData(
  config: BannerConfig,
  locale: Locale
): BannerData {
  const { link } = config
  const target = link?.target ? '_blank' : undefined

  return {
    id: config.id,
    title: t(config.titleKey, locale),
    description: config.descriptionKey
      ? t(config.descriptionKey, locale)
      : undefined,
    link: link
      ? {
          href: localizeHref(link.href, locale),
          title: t(link.titleKey, locale),
          target,
          rel: resolveRel({ target: target ?? '_self' }),
          buttonVariant: link.buttonVariant
        }
      : undefined
  }
}
