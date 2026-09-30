import { externalLinks, getRoutes, localizeHref } from '../config/routes'
import { categoryPath } from './learningPaths'
import type { Locale } from '../i18n/site'
import { t } from '../i18n/site'

export type NavColumnItem = {
  label: string
  href: string
  badge?: 'new' | 'beta'
  external?: boolean
}

export type NavColumn = {
  header: string
  items: NavColumnItem[]
}

export type NavFeatured = {
  imageSrc: string
  videoSrc?: string
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

export function getMainNavigation(
  locale: Locale,
  workshopInBuild = false
): NavItem[] {
  const routes = getRoutes(locale)
  const modelsEntry: NavItem[] = workshopInBuild
    ? [
        {
          label: t('nav.workshop', {}, { locale: locale }),
          href: routes.workshop,
          badge: 'new'
        }
      ]
    : []
  const productEntry: NavColumnItem[] = workshopInBuild
    ? [
        {
          label: t('nav.comfyWorkshop', {}, { locale: locale }),
          href: routes.workshop,
          badge: 'new'
        }
      ]
    : []
  return [
    ...modelsEntry,
    {
      label: t('nav.products', {}, { locale: locale }),
      badge: 'new',
      featured: {
        imageSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webp',
        videoSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webm',
        imageAlt: t('nav.featuredProductsAlt', {}, { locale: locale }),
        title: t('nav.featuredProductsTitle', {}, { locale: locale }),
        cta: {
          label: t('nav.featuredProductsCta', {}, { locale: locale }),
          ariaLabel: t('nav.featuredProductsCtaAria', {}, { locale: locale }),
          href: routes.geminiOmni
        }
      },
      columns: [
        {
          header: t('nav.products', {}, { locale: locale }),
          items: [
            ...productEntry,
            {
              label: t('nav.comfyLocal', {}, { locale: locale }),
              href: routes.download
            },
            {
              label: t('nav.comfyCloud', {}, { locale: locale }),
              href: routes.cloud
            },
            {
              label: t('nav.developerPlatform', {}, { locale: locale }),
              href: routes.platform,
              badge: 'new'
            },
            {
              label: t('nav.comfyRouter', {}, { locale: locale }),
              href: routes.platformRouter,
              badge: 'new'
            },
            {
              label: t('nav.comfyEnterprise', {}, { locale: locale }),
              href: routes.enterprise
            },
            {
              label: t('nav.managedBuilds', {}, { locale: locale }),
              href: routes.managedBuilds
            }
          ]
        },
        {
          header: t('nav.colFeatures', {}, { locale: locale }),
          items: [
            {
              label: t('nav.mcpServer', {}, { locale: locale }),
              href: routes.mcp
            },
            {
              label: t('nav.comfyAgent', {}, { locale: locale }),
              href: routes.agent,
              badge: 'new'
            },
            {
              label: t('nav.comfyCli', {}, { locale: locale }),
              href: routes.cli
            },
            // TODO: no page yet — re-enable when landing pages ship
            // { label: t('nav.appMode', {}, { locale: locale }), href: '#' },
            // { label: t('nav.agentSkills', {}, { locale: locale }), href: '#' },
            {
              label: t('nav.launches', {}, { locale: locale }),
              href: routes.launches
            },
            {
              label: t('nav.supportedModels', {}, { locale: locale }),
              href: routes.models
            },
            {
              label: t('nav.docs', {}, { locale: locale }),
              href: externalLinks.docs,
              external: true
            }
          ]
        }
      ]
    },
    { label: t('nav.pricing', {}, { locale: locale }), href: routes.pricing },
    {
      label: t('nav.community', {}, { locale: locale }),
      badge: 'new',
      featured: {
        imageSrc:
          'https://media.comfy.org/website/learning/advertising3-thumb.png',
        imageAlt: t('nav.featuredCommunityAlt', {}, { locale: locale }),
        title: t('nav.featuredCommunityTitle', {}, { locale: locale }),
        cta: {
          label: t('cta.watchDemo', {}, { locale: locale }),
          ariaLabel: t('nav.featuredCommunityCtaAria', {}, { locale: locale }),
          href: localizeHref(
            `${categoryPath('ads')}product-photography/`,
            locale
          )
        }
      },
      columns: [
        {
          header: t('nav.colPrograms', {}, { locale: locale }),
          items: [
            {
              label: t('nav.comfyHub', {}, { locale: locale }),
              href: externalLinks.workflows
            },
            {
              label: t('nav.fdct', {}, { locale: locale }),
              href: routes.fdct,
              badge: 'new'
            },
            {
              label: t('nav.customerStories', {}, { locale: locale }),
              href: routes.customers
            },
            {
              label: t('nav.events', {}, { locale: locale }),
              href: routes.events,
              badge: 'new'
            },
            {
              label: t('nav.affiliates', {}, { locale: locale }),
              href: routes.affiliates
            },
            {
              label: t('nav.learning', {}, { locale: locale }),
              href: routes.learning
            }
          ]
        },
        {
          header: t('nav.colConnect', {}, { locale: locale }),
          items: [
            {
              label: t('nav.discord', {}, { locale: locale }),
              href: externalLinks.discord,
              external: true
            },
            {
              label: t('nav.github', {}, { locale: locale }),
              href: externalLinks.github,
              external: true
            },
            {
              label: t('nav.youtube', {}, { locale: locale }),
              href: externalLinks.youtube,
              external: true
            },
            {
              label: t('nav.reddit', {}, { locale: locale }),
              href: externalLinks.reddit,
              external: true
            },
            {
              label: t('nav.x', {}, { locale: locale }),
              href: externalLinks.x,
              external: true
            },
            {
              label: t('nav.instagram', {}, { locale: locale }),
              href: externalLinks.instagram,
              external: true
            }
          ]
        }
      ]
    },
    {
      label: t('nav.company', {}, { locale: locale }),
      featured: {
        imageSrc: 'https://media.comfy.org/website/nav/customer-story-card.jpg',
        imageAlt: t('nav.featuredCompanyAlt', {}, { locale: locale }),
        title: t('nav.featuredCompanyTitle', {}, { locale: locale }),
        cta: {
          label: t('cta.watchNow', {}, { locale: locale }),
          ariaLabel: t('nav.featuredCompanyCtaAria', {}, { locale: locale }),
          href: routes.customerVideoBlackMath
        }
      },
      columns: [
        {
          header: t('nav.company', {}, { locale: locale }),
          items: [
            {
              label: t('nav.aboutUs', {}, { locale: locale }),
              href: routes.about
            },
            {
              label: t('nav.careers', {}, { locale: locale }),
              href: routes.careers
            },
            {
              label: t('nav.contact', {}, { locale: locale }),
              href: routes.contact
            }
          ]
        },
        {
          header: t('nav.colMore', {}, { locale: locale }),
          items: [
            {
              label: t('nav.customerStories', {}, { locale: locale }),
              href: routes.customers
            },
            // TODO: no /brand page yet
            // { label: t('nav.brand', {}, { locale: locale }), href: '#' },
            {
              label: t('nav.blogs', {}, { locale: locale }),
              href: externalLinks.blog,
              external: true
            }
          ]
        }
      ]
    }
  ]
}
