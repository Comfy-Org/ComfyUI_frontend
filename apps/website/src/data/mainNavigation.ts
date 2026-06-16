import { externalLinks, getRoutes } from '../config/routes'
import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

export type NavColumnItem = {
  label: string
  href: string
  badge?: 'new'
  external?: boolean
}

export type NavColumn = {
  header: string
  items: NavColumnItem[]
}

export type NavFeatured = {
  imageSrc: string
  imageAlt?: string
  title: string
  cta: {
    label: string
    ariaLabel?: string
    href: string
  }
}

export type NavItem =
  | {
      label: string
      columns: NavColumn[]
      featured?: NavFeatured
      href?: never
    }
  | { label: string; href: string; columns?: never; featured?: never }

const FEATURED_IMAGE_SRC =
  'https://media.comfy.org/website/customers/moment-factory/hero.webp'

export function getMainNavigation(locale: Locale): NavItem[] {
  const routes = getRoutes(locale)
  return [
    {
      label: t('nav.products', locale),
      featured: {
        imageSrc: FEATURED_IMAGE_SRC,
        imageAlt: t('nav.featuredSeedanceAlt', locale),
        title: t('nav.featuredSeedanceTitle', locale),
        cta: {
          label: t('cta.tryWorkflow', locale),
          ariaLabel: t('nav.featuredSeedanceCtaAria', locale),
          href: '#'
        }
      },
      columns: [
        {
          header: t('nav.products', locale),
          items: [
            { label: t('nav.comfyLocal', locale), href: routes.download },
            { label: t('nav.comfyCloud', locale), href: routes.cloud },
            {
              label: t('nav.comfyApi', locale),
              href: routes.api,
              badge: 'new'
            },
            {
              label: t('nav.comfyEnterprise', locale),
              href: routes.cloudEnterprise
            }
          ]
        },
        {
          header: t('nav.colFeatures', locale),
          items: [
            // TODO: no page yet — re-enable when landing pages ship
            // { label: t('nav.mcpServer', locale), href: '#', badge: 'new' },
            // { label: t('nav.appMode', locale), href: '#' },
            // { label: t('nav.agentSkills', locale), href: '#' },
            {
              label: t('nav.docs', locale),
              href: externalLinks.docs,
              external: true
            }
          ]
        }
      ]
    },
    { label: t('nav.pricing', locale), href: routes.cloudPricing },
    {
      label: t('nav.community', locale),
      featured: {
        imageSrc: FEATURED_IMAGE_SRC,
        imageAlt: t('nav.featuredReleaseDemoAlt', locale),
        title: t('nav.featuredReleaseDemoTitle', locale),
        cta: {
          label: t('cta.watchNow', locale),
          ariaLabel: t('nav.featuredReleaseDemoCtaAria', locale),
          href: '#'
        }
      },
      columns: [
        {
          header: t('nav.colPrograms', locale),
          items: [
            { label: t('nav.comfyHub', locale), href: externalLinks.workflows },
            { label: t('nav.gallery', locale), href: routes.gallery }
          ]
        },
        {
          header: t('nav.colConnect', locale),
          items: [
            {
              label: t('nav.discord', locale),
              href: externalLinks.discord,
              external: true
            },
            {
              label: t('nav.github', locale),
              href: externalLinks.github,
              external: true
            },
            {
              label: t('nav.youtube', locale),
              href: externalLinks.youtube,
              external: true
            },
            {
              label: t('nav.reddit', locale),
              href: externalLinks.reddit,
              external: true
            },
            {
              label: t('nav.x', locale),
              href: externalLinks.x,
              external: true
            },
            {
              label: t('nav.instagram', locale),
              href: externalLinks.instagram,
              external: true
            }
          ]
        },
        {
          header: t('nav.colSolutions', locale),
          items: [
            {
              label: t('nav.affiliates', locale),
              href: routes.affiliates,
              badge: 'new'
            },
            {
              label: t('nav.learning', locale),
              href: routes.learning,
              badge: 'new'
            }
          ]
        }
      ]
    },
    {
      label: t('nav.company', locale),
      featured: {
        imageSrc: FEATURED_IMAGE_SRC,
        imageAlt: t('nav.featuredBlackMathAlt', locale),
        title: t('nav.featuredBlackMathTitle', locale),
        cta: {
          label: t('cta.watchNow', locale),
          ariaLabel: t('nav.featuredBlackMathCtaAria', locale),
          href: '#'
        }
      },
      columns: [
        {
          header: t('nav.company', locale),
          items: [
            { label: t('nav.aboutUs', locale), href: routes.about },
            { label: t('nav.careers', locale), href: routes.careers }
          ]
        },
        {
          header: t('nav.colMore', locale),
          items: [
            {
              label: t('nav.customerStories', locale),
              href: routes.customers
            },
            // TODO: no /brand page yet
            // { label: t('nav.brand', locale), href: '#' },
            { label: t('nav.contact', locale), href: routes.contact },
            {
              label: t('nav.blogs', locale),
              href: externalLinks.blog,
              external: true
            }
          ]
        }
      ]
    }
  ]
}
