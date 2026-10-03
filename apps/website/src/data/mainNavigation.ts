import { externalLinks, getRoutes, localizeHref } from '../config/routes'
import { categoryPath } from './learningPaths'
import type { Locale } from '../i18n/translations'
import { translationsFor } from '../i18n/translations'

export type NavColumnItem = {
  label: string
  href: string
  badge?: 'new' | 'beta'
  external?: boolean
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
  const { t } = translationsFor(locale)
  const routes = getRoutes(locale)
  const inHub = <T>(items: T[]) => (workshopInBuild ? items : [])
  const releaseFeatured: NavFeatured = {
    imageSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webp',
    videoSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webm',
    imageAlt: t('nav.featuredProductsAlt'),
    title: t('nav.featuredProductsTitle'),
    cta: {
      label: t('nav.featuredProductsCta'),
      ariaLabel: t('nav.featuredProductsCtaAria'),
      href: routes.geminiOmni
    }
  }
  return [
    ...inHub<NavItem>([
      {
        label: t('nav.workshop'),
        href: routes.hubExplore,
        badge: 'new'
      }
    ]),
    {
      label: t('nav.products'),
      badge: 'new',
      featured: releaseFeatured,
      columns: [
        {
          header: t('nav.colCreate'),
          description: t('workshop.space.createHint'),
          items: [
            ...inHub([
              {
                label: t('nav.hubApps'),
                href: routes.hubApps
              },
              {
                label: t('nav.cinematicStudio'),
                href: routes.cinematicStudio,
                badge: 'new' as const
              }
            ]),
            { label: t('nav.comfyCloud'), href: routes.cloud }
          ]
        },
        {
          header: t('nav.colCustomize'),
          description: t('workshop.space.customizeHint'),
          items: [
            ...inHub([
              {
                label: t('nav.hubWorkflows'),
                href: routes.hubWorkflows
              }
            ]),
            { label: t('nav.comfyLocal'), href: routes.download },
            {
              label: t('nav.comfyAgent'),
              href: routes.agent,
              badge: 'new'
            }
          ]
        },
        {
          header: t('nav.colBuild'),
          description: t('workshop.space.buildHint'),
          items: [
            ...(workshopInBuild
              ? [
                  {
                    label: t('nav.hubModels'),
                    href: routes.workshop
                  }
                ]
              : [
                  {
                    label: t('nav.supportedModels'),
                    href: routes.models
                  }
                ]),
            {
              label: t('nav.developerPlatform'),
              href: routes.platform,
              badge: 'new'
            },
            {
              label: t('nav.serverlessApi'),
              href: routes.platformComfyApi
            },
            {
              label: t('nav.comfyRouter'),
              href: routes.platformRouter,
              badge: 'new'
            },
            { label: t('nav.builds'), href: routes.platformBuilder },
            {
              label: t('nav.managedBuilds'),
              href: routes.managedBuilds
            },
            { label: t('nav.mcpServer'), href: routes.mcp },
            { label: t('nav.comfyCli'), href: routes.cli }
          ]
        },
        {
          header: t('nav.resources'),
          placement: 'footer',
          items: [
            {
              label: t('nav.docs'),
              href: externalLinks.docs,
              external: true
            },
            {
              label: t('nav.comfySdks'),
              href: externalLinks.docsSdk,
              external: true
            },
            { label: t('nav.launches'), href: routes.launches }
          ]
        }
      ]
    },
    {
      label: t('nav.enterprise'),
      columns: [
        {
          header: t('nav.enterprise'),
          items: [
            {
              label: t('nav.comfyEnterprise'),
              href: routes.enterprise
            },
            { label: t('nav.fdct'), href: routes.fdct },
            {
              label: t('nav.commercialLicensing'),
              href: routes.minimaxLicense
            },
            { label: t('nav.contactSales'), href: routes.contact }
          ]
        }
      ]
    },
    { label: t('nav.pricing'), href: routes.pricing },
    {
      label: t('nav.community'),
      badge: 'new',
      featured: {
        imageSrc:
          'https://media.comfy.org/website/learning/advertising3-thumb.png',
        imageAlt: t('nav.featuredCommunityAlt'),
        title: t('nav.featuredCommunityTitle'),
        cta: {
          label: t('cta.watchDemo'),
          ariaLabel: t('nav.featuredCommunityCtaAria'),
          href: localizeHref(
            `${categoryPath('ads')}product-photography/`,
            locale
          )
        }
      },
      columns: [
        {
          header: t('nav.colPrograms'),
          items: [
            { label: t('nav.comfyHub'), href: externalLinks.workflows },
            {
              label: t('nav.fdct'),
              href: routes.fdct,
              badge: 'new'
            },
            {
              label: t('nav.customerStories'),
              href: routes.customers
            },
            {
              label: t('nav.events'),
              href: routes.events,
              badge: 'new'
            },
            {
              label: t('nav.affiliates'),
              href: routes.affiliates
            },
            {
              label: t('nav.learning'),
              href: routes.learning
            }
          ]
        },
        {
          header: t('nav.colConnect'),
          items: [
            {
              label: t('nav.discord'),
              href: externalLinks.discord,
              external: true
            },
            {
              label: t('nav.github'),
              href: externalLinks.github,
              external: true
            },
            {
              label: t('nav.youtube'),
              href: externalLinks.youtube,
              external: true
            },
            {
              label: t('nav.reddit'),
              href: externalLinks.reddit,
              external: true
            },
            {
              label: t('nav.x'),
              href: externalLinks.x,
              external: true
            },
            {
              label: t('nav.instagram'),
              href: externalLinks.instagram,
              external: true
            }
          ]
        }
      ]
    },
    {
      label: t('nav.company'),
      featured: {
        imageSrc: 'https://media.comfy.org/website/nav/customer-story-card.jpg',
        imageAlt: t('nav.featuredCompanyAlt'),
        title: t('nav.featuredCompanyTitle'),
        cta: {
          label: t('cta.watchNow'),
          ariaLabel: t('nav.featuredCompanyCtaAria'),
          href: routes.customerVideoBlackMath
        }
      },
      columns: [
        {
          header: t('nav.company'),
          items: [
            { label: t('nav.aboutUs'), href: routes.about },
            { label: t('nav.careers'), href: routes.careers },
            { label: t('nav.contact'), href: routes.contact }
          ]
        },
        {
          header: t('nav.colMore'),
          items: [
            {
              label: t('nav.customerStories'),
              href: routes.customers
            },
            // TODO: no /brand page yet
            // { label: t('nav.brand'), href: '#' },
            {
              label: t('nav.blogs'),
              href: externalLinks.blog,
              external: true
            }
          ]
        }
      ]
    }
  ]
}
