import type { AppWorkshopModel } from '@/config/models-catalogue'
import { externalLinks, getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

export type NavColumnItem = {
  label: string
  href: string
  icon?: string
  badge?: 'new' | 'beta'
  external?: boolean
  newTab?: boolean
}

export function navLinkTarget(
  item: Pick<NavColumnItem, 'external' | 'newTab'>
): { target?: '_blank'; rel?: string } {
  if (item.external) return { target: '_blank', rel: 'noopener noreferrer' }
  return item.newTab ? { target: '_blank', rel: 'noopener' } : {}
}

export type NavColumn = {
  header?: string
  description?: string
  items: NavColumnItem[]
  allLink?: Pick<NavColumnItem, 'label' | 'href'>
  placement?: 'footer'
}

/** Replacement media for one arm of a placement's image flag. */
type NavFeaturedVariant = {
  imageSrc: string
  videoSrc?: string
  imageAlt?: string
}

export type NavFeatured = {
  /**
   * Stable placement id sent with the card's analytics events. Keep it
   * unchanged across copy, image, and locale changes so the numbers stay
   * comparable; use a new id only for a different placement.
   */
  analyticsId?: string
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
  /**
   * Image arms for the PostHog multivariate flag
   * `nav-featured-card-image-<placement>` (the placement is the card's
   * `analyticsId`), keyed by the flag's variant keys. The top-level media is the `control`
   * arm. Images and videos must be hosted on media.comfy.org. A visitor whose
   * variant is not listed here sees the control card.
   */
  variants?: Record<string, NavFeaturedVariant>
}

export type NavItem =
  | {
      label: string
      columns: NavColumn[]
      featured?: NavFeatured
      /** Stable dropdown id for analytics, such as `products`. */
      analyticsId: string
      activePathPrefix?: string
      badge?: 'new'
      href?: never
    }
  | {
      label: string
      href: string
      badge?: 'new'
      columns?: never
      featured?: never
      activePathPrefix?: never
    }

/** A built Hub app and the PostHog flag it is shown behind, if any. */
export type HubApp = Pick<AppWorkshopModel, 'appId' | 'flag'>

export type HubSections = {
  workflows: boolean
  apps: boolean
  reshoot: boolean
}

export const NO_HUB_SECTIONS: HubSections = {
  workflows: false,
  apps: false,
  reshoot: false
}

export function getMainNavigation(
  locale: Locale,
  hubSections: HubSections = NO_HUB_SECTIONS
): NavItem[] {
  const { t } = translationsFor(locale)
  const routes = getRoutes(locale)
  const when = <T>(shown: boolean, entry: T): T[] => (shown ? [entry] : [])
  const seedance25Href = `${routes.workshop}seedance-2-5-reference-to-video/`
  return [
    {
      label: t('nav.workshop'),
      analyticsId: 'hub',
      activePathPrefix: '/hub/',
      featured: {
        analyticsId: 'seedance-2-5',
        imageSrc:
          'https://media.comfy.org/website/seedance-2.5/balloons-poster.webp',
        videoSrc: 'https://media.comfy.org/website/seedance-2.5/balloons.webm',
        imageAlt: t('nav.featuredHubAlt'),
        title: t('nav.hubSeedance25'),
        cta: {
          label: t('nav.featuredHubCta'),
          ariaLabel: t('nav.featuredHubCtaAria'),
          href: seedance25Href
        }
      },
      columns: [
        {
          header: t('nav.hubModels'),
          description: t('nav.hubModelsDescription'),
          items: [
            {
              label: t('nav.hubSeedream5Pro'),
              href: `${routes.workshop}seedream-5-0-pro-text-to-image/`
            },
            { label: t('nav.hubSeedance25'), href: seedance25Href },
            {
              label: t('nav.hubNanoBanana2'),
              href: `${routes.workshop}nano-banana-2-image-edit/`
            },
            {
              label: t('nav.hubGptImage2'),
              href: `${routes.workshop}gpt-image-2-text-to-image/`
            }
          ],
          allLink: { label: t('nav.hubAllModels'), href: routes.workshop }
        },
        ...when(hubSections.workflows, {
          header: t('nav.hubWorkflows'),
          description: t('nav.hubWorkflowsDescription'),
          items: [
            {
              label: t('nav.hubImageToVideo'),
              href: `${routes.hubWorkflows}image-to-video/`
            },
            {
              label: t('nav.hubVideoFromReferences'),
              href: `${routes.hubWorkflows}video-from-references/`
            },
            {
              label: t('nav.hubMotionTransfer'),
              href: `${routes.hubWorkflows}motion-transfer/`
            },
            {
              label: t('nav.hubEditSelectedRegion'),
              href: `${routes.hubWorkflows}edit-selected-region/`
            }
          ],
          allLink: {
            label: t('nav.hubAllWorkflows'),
            href: routes.hubWorkflows
          }
        }),
        ...when(hubSections.apps, {
          header: t('nav.hubApps'),
          description: t('nav.hubAppsDescription'),
          items: [
            {
              label: t('nav.cinematicStudio'),
              href: routes.cinematicStudio,
              newTab: true
            },
            ...when(hubSections.reshoot, {
              label: t('nav.reshoot'),
              href: routes.reshoot,
              newTab: true
            })
          ],
          allLink: { label: t('nav.hubAllApps'), href: routes.hubApps }
        })
      ]
    },
    {
      label: t('nav.products'),
      analyticsId: 'products',
      featured: {
        analyticsId: 'gemini-omni',
        imageSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webp',
        videoSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webm',
        imageAlt: t('nav.featuredProductsAlt'),
        title: t('nav.featuredProductsTitle'),
        cta: {
          label: t('nav.featuredProductsCta'),
          ariaLabel: t('nav.featuredProductsCtaAria'),
          href: routes.geminiOmni
        }
      },
      columns: [
        {
          header: t('nav.colCreate'),
          items: [
            { label: t('nav.comfyLocal'), href: routes.download },
            { label: t('nav.comfyCloud'), href: routes.cloud },
            {
              label: t('nav.comfyHub'),
              href: externalLinks.workflows
            }
          ]
        },
        {
          header: t('nav.colAutomate'),
          items: [
            {
              label: t('nav.comfyAgent'),
              href: routes.agent,
              badge: 'new'
            },
            { label: t('nav.mcpServer'), href: routes.mcp },
            {
              label: t('nav.comfyCli'),
              href: routes.cli
            }
          ]
        },
        {
          header: t('nav.colBuild'),
          items: [
            {
              label: t('nav.developerPlatform'),
              href: routes.platform,
              badge: 'new'
            },
            {
              label: t('nav.comfyApi'),
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
            }
          ]
        },
        {
          header: t('nav.colResources'),
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
            }
          ]
        }
      ]
    },
    {
      label: t('nav.enterprise'),
      analyticsId: 'enterprise',
      featured: {
        analyticsId: 'minimax-license',
        imageSrc:
          'https://media.comfy.org/website/minimax-license/hero-poster.jpg',
        videoSrc: 'https://media.comfy.org/website/minimax-license/hero.mp4',
        imageAlt: t('nav.featuredEnterpriseAlt'),
        title: t('minimaxLicense.breadcrumb.model'),
        cta: {
          label: t('minimaxLicense.runOptions.cta'),
          ariaLabel: `${t('minimaxLicense.runOptions.cta')}: ${t('minimaxLicense.breadcrumb.model')}`,
          href: routes.minimaxLicense
        }
      },
      columns: [
        {
          items: [
            {
              label: t('nav.comfyEnterprise'),
              href: routes.enterprise
            },
            {
              label: t('nav.fdct'),
              href: routes.fdct
            },
            {
              label: t('nav.teamBilling'),
              href: `${routes.pricing}#team`
            },
            {
              label: t('nav.commercialLicensing'),
              href: routes.minimaxLicense
            },
            {
              label: t('nav.contactSales'),
              href: routes.contact
            }
          ]
        }
      ]
    },
    { label: t('nav.pricing'), href: routes.pricing },
    {
      label: t('nav.company'),
      analyticsId: 'company',
      featured: {
        analyticsId: 'customer-story',
        imageSrc: 'https://media.comfy.org/website/nav/customer-story-card.jpg',
        showPlayOverlay: true,
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
          header: t('nav.community'),
          items: [
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
          header: t('nav.company'),
          items: [
            { label: t('nav.aboutUs'), href: routes.about },
            { label: t('nav.careers'), href: routes.careers },
            { label: t('nav.contact'), href: routes.contact }
          ]
        },
        {
          header: t('nav.colUpdates'),
          items: [
            {
              label: t('nav.customerStories'),
              href: routes.customers,
              badge: 'new'
            },
            { label: t('nav.launches'), href: routes.launches },
            {
              label: t('nav.blogs'),
              href: externalLinks.blog,
              external: true
            }
          ]
        },
        {
          header: t('nav.colConnect'),
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
            label: t(key),
            href,
            icon: `/icons/social/${icon}.svg`,
            external: true
          }))
        }
      ]
    }
  ]
}
