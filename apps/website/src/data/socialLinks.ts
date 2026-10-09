import { externalLinks } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

export type SocialLink = {
  label: string
  href: string
  icon: string
}

export function getSocialLinks(locale: Locale): SocialLink[] {
  const { t } = translationsFor(locale)
  return [
    {
      label: t('nav.github'),
      href: externalLinks.github,
      icon: "mask-[url('/icons/social/github.svg')]"
    },
    {
      label: t('nav.discord'),
      href: externalLinks.discord,
      icon: "mask-[url('/icons/social/discord.svg')]"
    },
    {
      label: t('nav.x'),
      href: externalLinks.x,
      icon: "mask-[url('/icons/social/x.svg')]"
    },
    {
      label: t('nav.youtube'),
      href: externalLinks.youtube,
      icon: "mask-[url('/icons/social/youtube.svg')]"
    },
    {
      label: t('nav.linkedin'),
      href: externalLinks.linkedin,
      icon: "mask-[url('/icons/social/linkedin.svg')]"
    },
    {
      label: t('nav.instagram'),
      href: externalLinks.instagram,
      icon: "mask-[url('/icons/social/instagram.svg')]"
    }
  ]
}
