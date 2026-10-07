import { externalLinks, getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

export type NavColumnItem = {
  label: string
  href: string
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
  header: string
  kind?: NavColumnKind
  description?: string
  placement?: 'footer'
  items: NavColumnItem[]
}

export type NavFeatured = {
  imageSrc: string
  videoSrc?: string
  imageAlt?: string
  eyebrow?: string
  compact?: boolean
  title: string
  cta: {
    label: string
    ariaLabel?: string
    href: string
  }
}

export type NavFooterLink = {
  label: string
  description: string
  href: string
}

export type NavItem =
  | {
      label: string
      columns: NavColumn[]
      featured?: NavFeatured
      footerLink?: NavFooterLink
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
      footerLink?: never
      activePathPrefix?: never
    }

export type HubSections = {
  workflows: boolean
  apps: boolean
}

export const NO_HUB_SECTIONS: HubSections = { workflows: false, apps: false }

export function getMainNavigation(
  locale: Locale,
  workshopInBuild = false,
  hubSections: HubSections = NO_HUB_SECTIONS
): NavItem[] {
  const { t } = translationsFor(locale)
  const routes = getRoutes(locale)
  const when = <T>(shown: boolean, items: T[]) => (shown ? items : [])
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
          {
            label: t('nav.hubSeedream5Pro'),
            href: `${routes.workshop}seedream-5-0-pro-text-to-image/`
          },
          {
            label: t('nav.hubKlingO3'),
            href: `${routes.workshop}kling-o3-text-to-video/`
          },
          { label: t('nav.hubAllModels'), href: routes.workshop, seeAll: true }
        ]
      },
      ...when<NavColumn>(hubSections.workflows, [
        {
          header: t('nav.hubWorkflows'),
          kind: 'workflow',
          description: t('nav.hubWorkflowsHint'),
          items: [
            {
              label: t('nav.hubChangeMaterial'),
              href: `${routes.hubWorkflows}change-material/`
            },
            {
              label: t('nav.hubMatchLighting'),
              href: `${routes.hubWorkflows}match-lighting/`
            },
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
            {
              label: t('nav.cinematicStudio'),
              href: routes.cinematicStudio,
              newTab: true
            },
            { label: t('nav.reshoot'), href: routes.reshoot, newTab: true },
            { label: t('nav.hubAllApps'), href: routes.hubApps, seeAll: true }
          ]
        }
      ])
    ],
    footerLink: {
      label: t('nav.hubExplore'),
      description: t('nav.hubExploreHint'),
      href: routes.hubExplore
    }
  }
  return [
    ...when(workshopInBuild, [hub]),
    {
      label: t('nav.products'),
      badge: 'new',
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
            { label: t('nav.comfyCloud'), href: routes.cloud }
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
            { label: t('nav.comfyCli'), href: routes.cli }
          ]
        },
        {
          header: t('nav.colBuild'),
          items: [
            ...when(!workshopInBuild, [
              { label: t('nav.supportedModels'), href: routes.models }
            ]),
            {
              label: t('nav.developerPlatform'),
              href: routes.platform,
              badge: 'new'
            },
            { label: t('nav.comfyApi'), href: routes.platformComfyApi },
            {
              label: t('nav.comfyRouter'),
              href: routes.platformRouter,
              badge: 'new'
            },
            { label: t('nav.builds'), href: routes.platformBuilder },
            { label: t('nav.managedBuilds'), href: routes.managedBuilds }
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
      featured: {
        imageSrc:
          'https://media.comfy.org/website/gallery/amber-passage_compressed.jpg',
        imageAlt: t('nav.featuredEnterpriseAlt'),
        title: t('nav.featuredEnterpriseTitle'),
        cta: {
          label: t('nav.featuredEnterpriseCta'),
          ariaLabel: t('nav.featuredEnterpriseCtaAria'),
          href: routes.minimaxLicense
        }
      },
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
      label: t('nav.company'),
      featured: {
        imageSrc: 'https://media.comfy.org/website/nav/customer-story-card.jpg',
        imageAlt: t('nav.featuredCompanyAlt'),
        eyebrow: t('nav.featuredCompanyEyebrow'),
        compact: true,
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
          header: t('nav.updates'),
          items: [
            { label: t('nav.customerStories'), href: routes.customers },
            {
              label: t('nav.blogs'),
              href: externalLinks.blog,
              external: true
            }
          ]
        },
        {
          header: t('nav.community'),
          items: [
            {
              label: t('nav.events'),
              href: routes.events,
              badge: 'new'
            },
            { label: t('nav.learning'), href: routes.learning },
            { label: t('nav.affiliates'), href: routes.affiliates }
          ]
        }
      ]
    }
  ]
}
