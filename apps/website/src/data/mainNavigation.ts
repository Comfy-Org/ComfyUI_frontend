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
      badge?: 'new'
      href?: never
    }
  | {
      label: string
      href: string
      badge?: 'new'
      columns?: never
      featured?: never
    }

export function getMainNavigation(locale: Locale): NavItem[] {
  const routes = getRoutes(locale)
  return [
    {
      label: t('nav.products', locale),
      badge: 'new',
      featured: {
        imageSrc: 'https://media.comfy.org/website/nav/mcp-card.webp',
        imageAlt: t('nav.featuredProductsAlt', locale),
        title: t('nav.featuredProductsTitle', locale),
        cta: {
          label: t('cta.getStarted', locale),
          ariaLabel: t('nav.featuredProductsCtaAria', locale),
          href: routes.mcp
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
            {
              label: t('nav.mcpServer', locale),
              href: routes.mcp,
              badge: 'new'
            },
            // TODO: no page yet — re-enable when landing pages ship
            // { label: t('nav.appMode', locale), href: '#' },
            // { label: t('nav.agentSkills', locale), href: '#' },
            {
              label: t('nav.launches', locale),
              href: routes.launches,
              badge: 'new'
            },
            { label: t('nav.supportedModels', locale), href: routes.models },
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
      badge: 'new',
      featured: {
        imageSrc: 'https://media.comfy.org/website/nav/featured-demo-card.jpg',
        imageAlt: t('nav.featuredCommunityAlt', locale),
        title: t('nav.featuredCommunityTitle', locale),
        cta: {
          label: t('cta.watchDemo', locale),
          ariaLabel: t('nav.featuredCommunityCtaAria', locale),
          href: 'https://comfy.org/workflows/537cf7f1f745-537cf7f1f745/'
        }
      },
      columns: [
        {
          header: t('nav.colPrograms', locale),
          items: [
            { label: t('nav.comfyHub', locale), href: externalLinks.workflows },
            { label: t('nav.gallery', locale), href: routes.gallery },
            {
              label: t('nav.affiliates', locale),
              href: routes.affiliates,
              badge: 'new'
            },
            {
              label: t('nav.learning', locale),
              href: routes.learning,
              badge: 'new'
            },
            {
              label: t('nav.education', locale),
              href: routes.education,
              badge: 'new'
            }
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
        }
      ]
    },
    {
      label: t('nav.company', locale),
      featured: {
        imageSrc: 'https://media.comfy.org/website/nav/customer-story-card.jpg',
        imageAlt: t('nav.featuredCompanyAlt', locale),
        title: t('nav.featuredCompanyTitle', locale),
        cta: {
          label: t('cta.watchNow', locale),
          ariaLabel: t('nav.featuredCompanyCtaAria', locale),
          href: '/customers#hero-video'
        }
      },
      columns: [
        {
          header: t('nav.company', locale),
          items: [
            { label: t('nav.aboutUs', locale), href: routes.about },
            { label: t('nav.careers', locale), href: routes.careers },
            { label: t('nav.contact', locale), href: routes.contact }
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
