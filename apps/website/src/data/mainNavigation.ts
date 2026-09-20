import { externalLinks, getRoutes } from '../config/routes'
import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

export type NavColumnItem = {
  label: string
  href: string
  badge?: 'new' | 'beta'
  external?: boolean
}

export type NavColumn = {
  header?: string
  items: NavColumnItem[]
  placement?: 'footer'
}

export type NavFeatured = {
  imageSrc: string
  videoSrc?: string
  showPlayOverlay?: boolean
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
        imageSrc: 'https://media.comfy.org/website/nav/minimax-card.webp',
        videoSrc:
          'https://media.comfy.org/website/minimax-h3/hero-dragon-960.webm',
        imageAlt: t('nav.featuredProductsAlt', locale),
        title: t('nav.featuredProductsTitle', locale),
        cta: {
          label: t('nav.featuredProductsCta', locale),
          ariaLabel: t('nav.featuredProductsCtaAria', locale),
          href: routes.minimax
        }
      },
      columns: [
        {
          header: t('nav.colCreate', locale),
          items: [
            { label: t('nav.comfyLocal', locale), href: routes.download },
            { label: t('nav.comfyCloud', locale), href: routes.cloud },
            {
              label: t('nav.comfyHub', locale),
              href: externalLinks.workflows
            },
            { label: t('nav.supportedModels', locale), href: routes.models }
          ]
        },
        {
          header: t('nav.colAutomate', locale),
          items: [
            {
              label: t('nav.comfyAgent', locale),
              href: routes.agent,
              badge: 'beta'
            },
            { label: t('nav.mcpServer', locale), href: routes.mcp },
            {
              label: t('nav.comfyCli', locale),
              href: routes.cli,
              badge: 'new'
            }
          ]
        },
        {
          header: t('nav.colBuild', locale),
          items: [
            {
              label: t('nav.developerPlatform', locale),
              href: routes.platform,
              badge: 'beta'
            },
            {
              label: t('nav.serverlessApi', locale),
              href: routes.platformComfyApi
            },
            {
              label: t('nav.comfyRouter', locale),
              href: routes.platformRouter
            },
            { label: t('nav.builds', locale), href: routes.platformBuilder },
            {
              label: t('nav.managedBuilds', locale),
              href: routes.managedBuilds,
              badge: 'beta'
            }
          ]
        },
        {
          header: t('nav.colResources', locale),
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
      featured: {
        imageSrc:
          'https://media.comfy.org/website/minimax-license/hero-poster.jpg',
        videoSrc: 'https://media.comfy.org/website/minimax-license/hero.mp4',
        title: t('minimaxLicense.breadcrumb.model', locale),
        cta: {
          label: t('minimaxLicense.runOptions.cta', locale),
          ariaLabel: `${t('minimaxLicense.runOptions.cta', locale)}: ${t('minimaxLicense.breadcrumb.model', locale)}`,
          href: routes.minimaxLicense
        }
      },
      columns: [
        {
          items: [
            {
              label: t('nav.comfyEnterprise', locale),
              href: routes.enterprise
            },
            {
              label: t('nav.fdct', locale),
              href: routes.fdct
            },
            {
              label: t('nav.teamBilling', locale),
              href: `${routes.pricing}#team`
            },
            {
              label: t('nav.commercialLicensing', locale),
              href: routes.minimaxLicense
            },
            {
              label: t('nav.contactSales', locale),
              href: routes.contact
            }
          ]
        }
      ]
    },
    { label: t('nav.pricing', locale), href: routes.pricing },
    {
      label: t('nav.community', locale),
      badge: 'new',
      featured: {
        imageSrc: 'https://media.comfy.org/website/nav/featured-demo-card.jpg',
        showPlayOverlay: true,
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
          header: t('nav.colExplore', locale),
          items: [
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
              href: routes.learning,
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
        showPlayOverlay: true,
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
          header: t('nav.colUpdates', locale),
          items: [
            {
              label: t('nav.customerStories', locale),
              href: routes.customers
            },
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
