import { externalLinks, getRoutes } from '../config/routes'
import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

export type NavColumnItem = {
  label: string
  href: string
  analyticsId: string
  contributesToParentActive?: boolean
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
  analyticsId: string
  cta: {
    label: string
    ariaLabel?: string
    href: string
  }
}

export type NavItem =
  | {
      label: string
      analyticsId: string
      columns: NavColumn[]
      featured?: NavFeatured
      layout?: 'default' | 'wide'
      badge?: 'new'
      href?: never
    }
  | {
      label: string
      analyticsId: string
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
      analyticsId: 'products',
      featured: {
        imageSrc: 'https://media.comfy.org/website/nav/mcp-card.webp',
        imageAlt: t('nav.featuredProductsAlt', locale),
        title: t('nav.featuredProductsTitle', locale),
        analyticsId: 'comfy-mcp-featured',
        cta: {
          label: t('cta.getStarted', locale),
          ariaLabel: t('nav.featuredProductsCtaAria', locale),
          href: routes.mcp
        }
      },
      columns: [
        {
          header: t('nav.colCreate', locale),
          items: [
            {
              label: t('nav.comfyLocal', locale),
              href: routes.download,
              analyticsId: 'comfy-desktop'
            },
            {
              label: t('nav.comfyCloud', locale),
              href: routes.cloud,
              analyticsId: 'comfy-cloud'
            }
          ]
        },
        {
          header: t('nav.colBuild', locale),
          items: [
            {
              label: t('nav.comfyApi', locale),
              href: routes.api,
              analyticsId: 'comfy-api',
              badge: 'new'
            },
            {
              label: t('nav.mcpServer', locale),
              href: routes.mcp,
              analyticsId: 'comfy-mcp',
              badge: 'new'
            }
          ]
        }
      ]
    },
    {
      label: t('nav.resources', locale),
      analyticsId: 'resources',
      layout: 'wide',
      featured: {
        imageSrc: 'https://media.comfy.org/website/nav/featured-demo-card.jpg',
        imageAlt: t('nav.featuredResourcesAlt', locale),
        title: t('nav.featuredResourcesTitle', locale),
        analyticsId: 'featured-workflow',
        cta: {
          label: t('cta.watchDemo', locale),
          ariaLabel: t('nav.featuredResourcesCtaAria', locale),
          href: 'https://comfy.org/workflows/537cf7f1f745-537cf7f1f745/'
        }
      },
      columns: [
        {
          header: t('nav.colLearn', locale),
          items: [
            {
              label: t('nav.learning', locale),
              href: routes.learning,
              analyticsId: 'learning',
              badge: 'new'
            },
            {
              label: t('nav.docs', locale),
              href: externalLinks.docs,
              analyticsId: 'docs',
              external: true
            },
            {
              label: t('nav.blogs', locale),
              href: externalLinks.blog,
              analyticsId: 'blog',
              external: true
            },
            {
              label: t('nav.youtube', locale),
              href: externalLinks.youtube,
              analyticsId: 'youtube',
              external: true
            }
          ]
        },
        {
          header: t('nav.colDiscover', locale),
          items: [
            {
              label: t('nav.comfyHub', locale),
              href: externalLinks.workflows,
              analyticsId: 'comfy-hub'
            },
            {
              label: t('nav.gallery', locale),
              href: routes.gallery,
              analyticsId: 'gallery'
            },
            {
              label: t('nav.supportedModels', locale),
              href: routes.models,
              analyticsId: 'supported-models'
            }
          ]
        },
        {
          header: t('nav.colStayCurrent', locale),
          items: [
            {
              label: t('nav.whatsNew', locale),
              href: routes.launches,
              analyticsId: 'whats-new',
              badge: 'new'
            },
            {
              label: t('nav.customerStories', locale),
              href: routes.customers,
              analyticsId: 'customer-stories',
              contributesToParentActive: false
            }
          ]
        },
        {
          header: t('nav.community', locale),
          items: [
            {
              label: t('nav.affiliateProgram', locale),
              href: routes.affiliates,
              analyticsId: 'affiliate-program',
              badge: 'new'
            },
            {
              label: t('nav.discord', locale),
              href: externalLinks.discord,
              analyticsId: 'discord',
              external: true
            },
            {
              label: t('nav.github', locale),
              href: externalLinks.github,
              analyticsId: 'github',
              external: true
            }
          ]
        }
      ]
    },
    {
      label: t('nav.enterprise', locale),
      analyticsId: 'enterprise',
      featured: {
        imageSrc: 'https://media.comfy.org/website/nav/customer-story-card.jpg',
        imageAlt: t('nav.featuredEnterpriseAlt', locale),
        title: t('nav.featuredEnterpriseTitle', locale),
        analyticsId: 'enterprise-featured',
        cta: {
          label: t('nav.enterpriseOverview', locale),
          ariaLabel: t('nav.featuredEnterpriseCtaAria', locale),
          href: routes.cloudEnterprise
        }
      },
      columns: [
        {
          header: t('nav.colEvaluate', locale),
          items: [
            {
              label: t('nav.enterpriseOverview', locale),
              href: routes.cloudEnterprise,
              analyticsId: 'enterprise-overview'
            },
            {
              label: t('nav.customerStories', locale),
              href: routes.customers,
              analyticsId: 'customer-stories'
            }
          ]
        },
        {
          header: t('nav.colContact', locale),
          items: [
            {
              label: t('nav.contactSales', locale),
              href: routes.contact,
              analyticsId: 'contact-sales'
            },
            {
              label: t('nav.support', locale),
              href: externalLinks.support,
              analyticsId: 'support',
              external: true
            }
          ]
        }
      ]
    },
    {
      label: t('nav.pricing', locale),
      href: routes.cloudPricing,
      analyticsId: 'pricing'
    }
  ]
}
