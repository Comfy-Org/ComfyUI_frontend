import { externalLinks } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

export interface PlatformCta {
  label: string
  href: string
  target?: '_blank'
}

/**
 * Calls-to-action for the Developer Platform page: the console is the
 * product ("Get Started"), the docs quickstart is the secondary path.
 */
export function platformCtas(locale: Locale): {
  getStarted: PlatformCta
  docs: PlatformCta
} {
  const { t } = translationsFor(locale)
  return {
    getStarted: {
      label: t('platform.hero.getStarted'),
      href: externalLinks.platform,
      target: '_blank'
    },
    docs: {
      label: t('platform.hero.readDocs'),
      href: externalLinks.docsPlatform,
      target: '_blank'
    }
  }
}
