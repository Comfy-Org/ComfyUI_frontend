import { externalLinks, getRoutes, localizeHref } from '../config/routes'
import { categoryPath } from './learningPaths'
import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

export type NavColumnItem = {
  label: string
  href: string
  badge?: 'new' | 'beta'
  external?: boolean
  hub?: boolean
}

export type NavColumn = {
  header: string
  description?: string
  placement?: 'footer'
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
  const inHub = <T>(items: T[]) => (workshopInBuild ? items : [])
  const releaseFeatured: NavFeatured = {
    imageSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webp',
    videoSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webm',
    imageAlt: t('nav.featuredProductsAlt', locale),
    title: t('nav.featuredProductsTitle', locale),
    cta: {
      label: t('nav.featuredProductsCta', locale),
      ariaLabel: t('nav.featuredProductsCtaAria', locale),
      href: routes.geminiOmni
    }
  }
  return [
    ...inHub<NavItem>([
      {
        label: t('nav.workshop', locale),
        href: routes.hubExplore,
        badge: 'new'
      }
    ]),
    {
      label: t('nav.products', locale),
      badge: 'new',
      featured: releaseFeatured,
      columns: [
        {
          header: t('nav.colCreate', locale),
          description: t('workshop.space.createHint', locale),
          items: [
            ...inHub([
              {
                label: t('nav.hubApps', locale),
                href: routes.hubApps,
                hub: true
              },
              {
                label: t('nav.cinematicStudio', locale),
                href: routes.cinematicStudio,
                badge: 'new' as const
              }
            ]),
            { label: t('nav.comfyCloud', locale), href: routes.cloud }
          ]
        },
        {
          header: t('nav.colCustomize', locale),
          description: t('workshop.space.customizeHint', locale),
          items: [
            ...inHub([
              {
                label: t('nav.hubWorkflows', locale),
                href: routes.hubWorkflows,
                hub: true
              }
            ]),
            { label: t('nav.comfyLocal', locale), href: routes.download },
            {
              label: t('nav.comfyAgent', locale),
              href: routes.agent,
              badge: 'new'
            }
          ]
        },
        {
          header: t('nav.colBuild', locale),
          description: t('workshop.space.buildHint', locale),
          items: [
            ...(workshopInBuild
              ? [
                  {
                    label: t('nav.hubModels', locale),
                    href: routes.workshop,
                    hub: true
                  }
                ]
              : [
                  {
                    label: t('nav.supportedModels', locale),
                    href: routes.models
                  }
                ]),
            {
              label: t('nav.developerPlatform', locale),
              href: routes.platform,
              badge: 'new'
            },
            {
              label: t('nav.serverlessApi', locale),
              href: routes.platformComfyApi
            },
            {
              label: t('nav.comfyRouter', locale),
              href: routes.platformRouter,
              badge: 'new'
            },
            { label: t('nav.builds', locale), href: routes.platformBuilder },
            {
              label: t('nav.managedBuilds', locale),
              href: routes.managedBuilds
            },
            { label: t('nav.mcpServer', locale), href: routes.mcp },
            { label: t('nav.comfyCli', locale), href: routes.cli }
          ]
        },
        {
          header: t('nav.resources', locale),
          placement: 'footer',
          items: [
            {
              label: t('nav.docs', locale),
              href: externalLinks.docs,
              external: true
            },
            {
              label: t('nav.comfySdks', locale),
              href: externalLinks.docsSdk,
              external: true
            },
            { label: t('nav.launches', locale), href: routes.launches }
          ]
        }
      ]
    },
    {
      label: t('nav.enterprise', locale),
      columns: [
        {
          header: t('nav.enterprise', locale),
          items: [
            {
              label: t('nav.comfyEnterprise', locale),
              href: routes.enterprise
            },
            { label: t('nav.fdct', locale), href: routes.fdct },
            {
              label: t('nav.commercialLicensing', locale),
              href: routes.minimaxLicense
            },
            { label: t('nav.contactSales', locale), href: routes.contact }
          ]
        }
      ]
    },
    { label: t('nav.pricing', locale), href: routes.pricing },
    {
      label: t('nav.community', locale),
      badge: 'new',
      featured: {
        imageSrc:
          'https://media.comfy.org/website/learning/advertising3-thumb.png',
        imageAlt: t('nav.featuredCommunityAlt', locale),
        title: t('nav.featuredCommunityTitle', locale),
        cta: {
          label: t('cta.watchDemo', locale),
          ariaLabel: t('nav.featuredCommunityCtaAria', locale),
          href: localizeHref(
            `${categoryPath('ads')}product-photography/`,
            locale
          )
        }
      },
      columns: [
        {
          header: t('nav.colPrograms', locale),
          items: [
            { label: t('nav.comfyHub', locale), href: externalLinks.workflows },
            {
              label: t('nav.fdct', locale),
              href: routes.fdct,
              badge: 'new'
            },
            {
              label: t('nav.customerStories', locale),
              href: routes.customers
            },
            {
              label: t('nav.events', locale),
              href: routes.events,
              badge: 'new'
            },
            {
              label: t('nav.affiliates', locale),
              href: routes.affiliates
            },
            {
              label: t('nav.learning', locale),
              href: routes.learning
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
          href: routes.customerVideoBlackMath
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
