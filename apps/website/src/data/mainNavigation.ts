import { externalLinks, getRoutes } from '../config/routes'
import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

export type NavColumnItem = {
  label: string
  href: string
  icon?: string
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
        imageSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webp',
        videoSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webm',
        imageAlt: t('nav.featuredProductsAlt', locale),
        title: t('nav.featuredProductsTitle', locale),
        cta: {
          label: t('nav.featuredProductsCta', locale),
          ariaLabel: t('nav.featuredProductsCtaAria', locale),
          href: routes.geminiOmni
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
            {
              label: t('nav.comfyWorkshop', locale),
              href: routes.workshop,
              badge: 'new'
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
              badge: 'new'
            },
            { label: t('nav.mcpServer', locale), href: routes.mcp },
            {
              label: t('nav.comfyCli', locale),
              href: routes.cli
            }
          ]
        },
        {
          header: t('nav.colBuild', locale),
          items: [
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
            }
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
          header: t('nav.community', locale),
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
              href: routes.learning
            }
          ]
        },
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
            { label: t('nav.launches', locale), href: routes.launches },
            {
              label: t('nav.blogs', locale),
              href: externalLinks.blog,
              external: true
            }
          ]
        },
        {
          header: t('nav.colConnect', locale),
          placement: 'footer',
          items: (
            [
              ['nav.discord', externalLinks.discord, 'discord'],
              ['nav.github', externalLinks.github, 'github'],
              ['nav.youtube', externalLinks.youtube, 'youtube'],
              ['nav.reddit', externalLinks.reddit, 'reddit'],
              ['nav.x', externalLinks.x, 'x'],
              ['nav.instagram', externalLinks.instagram, 'instagram']
            ] as const
          ).map(([key, href, icon]) => ({
            label: t(key, locale),
            href,
            icon: `/icons/social/${icon}.svg`,
            external: true
          }))
        }
      ]
    }
  ]
}
