import { externalLinks, getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

export type NavItemPreview = {
  meta?: string
}

/** Catalogue previews for the Hub menu, keyed by the entry's page. */
export type HubMenuPreviews = Readonly<Record<string, NavItemPreview>>

export type NavColumnItem = NavItemPreview & {
  label: string
  href: string
  icon?: string
  badge?: 'new' | 'beta'
  external?: boolean
  /** Opens in a tab of its own without leaving the site, like a full-screen app. */
  newTab?: boolean
  seeAll?: boolean
}

/** Where a menu link opens: another site, or an app in a tab of its own. */
export function navLinkTarget(
  item: Pick<NavColumnItem, 'external' | 'newTab'>
): { target?: '_blank'; rel?: string } {
  if (item.external) return { target: '_blank', rel: 'noopener noreferrer' }
  return item.newTab ? { target: '_blank', rel: 'noopener' } : {}
}

type NavColumnKind = 'model' | 'workflow' | 'app'

export type NavColumn = {
  header?: string
  kind?: NavColumnKind
  description?: string
  placement?: 'footer'
  items: NavColumnItem[]
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

export type NavExploreLink = {
  label: string
  intro: string
  href: string
}

export type NavItem =
  | {
      label: string
      columns: NavColumn[]
      featured?: NavFeatured
      exploreLink?: NavExploreLink
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
      exploreLink?: never
      activePathPrefix?: never
    }

export type HubSections = {
  workflows: boolean
  apps: boolean
}

export const NO_HUB_SECTIONS: HubSections = { workflows: false, apps: false }

export function getMainNavigation(
  locale: Locale,
  hubSections: HubSections = NO_HUB_SECTIONS,
  hubPreviews: HubMenuPreviews = {}
): NavItem[] {
  const { t } = translationsFor(locale)
  const routes = getRoutes(locale)
  const when = <T>(shown: boolean, items: T[]) => (shown ? items : [])
  const previewed = (item: NavColumnItem): NavColumnItem => ({
    ...hubPreviews[item.href],
    ...item
  })
  const hub: NavItem = {
    label: t('nav.workshop'),
    badge: 'new',
    activePathPrefix: routes.hubExplore,
    columns: [
      {
        header: t('nav.hubModels'),
        kind: 'model',
        description: t('nav.hubModelsHint'),
        items: [
          previewed({
            label: t('nav.hubSeedream5Pro'),
            href: `${routes.workshop}seedream-5-0-pro-text-to-image/`
          }),
          previewed({
            label: t('nav.hubSeedance25'),
            href: `${routes.workshop}seedance-2-5-reference-to-video/`
          }),
          previewed({
            label: t('nav.hubNanoBanana2'),
            href: `${routes.workshop}nano-banana-2-image-edit/`
          }),
          previewed({
            label: t('nav.hubGptImage2'),
            href: `${routes.workshop}gpt-image-2-text-to-image/`
          }),
          { label: t('nav.hubAllModels'), href: routes.workshop, seeAll: true }
        ]
      },
      ...when<NavColumn>(hubSections.workflows, [
        {
          header: t('nav.hubWorkflows'),
          kind: 'workflow',
          description: t('nav.hubWorkflowsHint'),
          items: [
            previewed({
              label: t('nav.hubChangeMaterial'),
              href: `${routes.hubWorkflows}change-material/`
            }),
            previewed({
              label: t('nav.hubMatchLighting'),
              href: `${routes.hubWorkflows}match-lighting/`
            }),
            {
              label: t('nav.hubAllWorkflows'),
              href: routes.hubWorkflows,
              seeAll: true
            }
          ]
        }
      ]),
      ...when<NavColumn>(hubSections.apps, [
        {
          header: t('nav.hubApps'),
          kind: 'app',
          description: t('nav.hubAppsHint'),
          items: [
            previewed({
              label: t('nav.cinematicStudio'),
              href: routes.cinematicStudio,
              newTab: true
            }),
            previewed({
              label: t('nav.reshoot'),
              href: routes.reshoot,
              newTab: true
            }),
            { label: t('nav.hubAllApps'), href: routes.hubApps, seeAll: true }
          ]
        }
      ])
    ],
    exploreLink: {
      label: t('nav.hubExplore'),
      intro: t('nav.hubExploreHint'),
      href: routes.hubExplore
    }
  }
  return [
    hub,
    {
      label: t('nav.products'),
      featured: {
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
            {
              label: t('nav.comfyWorkshop'),
              href: routes.workshop,
              badge: 'new'
            },
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
      featured: {
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
      featured: {
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
