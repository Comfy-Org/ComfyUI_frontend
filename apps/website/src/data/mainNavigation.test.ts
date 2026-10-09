import { describe, expect, it } from 'vitest'

import hubAppNames from '@/config/hub-app-names.json' with { type: 'json' }
import hubWorkflowNames from '@/config/hub-workflow-names.json' with { type: 'json' }
import { modelPageUrls } from '@/config/model-urls'
import { getRoutes } from '@/config/routes'
import { t } from '@/i18n/translations'
import type { HubSections, NavColumn, NavItem } from './mainNavigation'
import { getMainNavigation } from './mainNavigation'

const ALL_SECTIONS: HubSections = { workflows: true, apps: true }

function hubOf(navigation: NavItem[]): NavItem {
  const hub = navigation[0]
  expect(hub.label).toBe('Hub')
  return hub
}

function columnsOf(item: NavItem): NavColumn[] {
  return (item.columns ?? []).filter((column) => column.placement !== 'footer')
}

function browseRowOf(item: NavItem): NavColumn | undefined {
  return item.columns?.find((column) => column.placement === 'footer')
}

describe('getMainNavigation', () => {
  it.for(['en', 'zh-CN', 'ja'] as const)(
    'links the Hub catalogue from the Hub Browse row and under Products > Create, for %s',
    (locale) => {
      const navigation = getMainNavigation(locale)
      const catalogue = getRoutes(locale).workshop
      const create = navigation
        .find((item) => item.label === t('nav.products', {}, { locale }))
        ?.columns?.find(
          (column) => column.header === t('nav.colCreate', {}, { locale })
        )

      expect(catalogue).toBe('/hub/models/')
      expect(navigation[0].label).toBe(t('nav.workshop', {}, { locale }))
      expect(browseRowOf(navigation[0])?.items).toContainEqual({
        label: t('nav.hubAllModels', {}, { locale }),
        href: catalogue
      })
      expect(create?.items).toContainEqual({
        label: t('nav.comfyWorkshop', {}, { locale }),
        href: catalogue,
        badge: 'new'
      })
    }
  )

  it.for([
    {
      sections: { workflows: false, apps: false },
      headers: ['Models'],
      browse: ['All models']
    },
    {
      sections: { workflows: true, apps: false },
      headers: ['Models', 'Workflows'],
      browse: ['All models', 'All workflows']
    },
    {
      sections: { workflows: false, apps: true },
      headers: ['Models', 'Apps'],
      browse: ['All models', 'All apps']
    },
    {
      sections: ALL_SECTIONS,
      headers: ['Models', 'Workflows', 'Apps'],
      browse: ['All models', 'All workflows', 'All apps']
    }
  ])(
    'opens the Hub with columns $headers and a Browse row of $browse',
    ({ sections, headers, browse }) => {
      const hub = hubOf(getMainNavigation('en', sections))

      expect(hub.href).toBeUndefined()
      expect(columnsOf(hub).map((column) => column.header)).toEqual(headers)
      expect(browseRowOf(hub)?.header).toBe('Browse')
      expect(browseRowOf(hub)?.items.map(({ label }) => label)).toEqual(browse)
      expect(hub.activePathPrefix).toBe('/hub/')
    }
  )

  it('describes each Hub column and lists two examples in it', () => {
    const hub = hubOf(getMainNavigation('en', ALL_SECTIONS))

    expect(
      columnsOf(hub).map(({ description, items }) => ({
        description,
        items: items.map(({ label, href, newTab }) => ({ label, href, newTab }))
      }))
    ).toEqual([
      {
        description: 'Run the latest AI models',
        items: [
          {
            label: 'Seedream 5.0 Pro',
            href: '/hub/models/seedream-5-0-pro-text-to-image/',
            newTab: undefined
          },
          {
            label: 'Seedance 2.5',
            href: '/hub/models/seedance-2-5-reference-to-video/',
            newTab: undefined
          }
        ]
      },
      {
        description: 'Ready-made recipes for a task',
        items: [
          {
            label: 'Image to video',
            href: '/hub/workflows/image-to-video/',
            newTab: undefined
          },
          {
            label: 'Video from references',
            href: '/hub/workflows/video-from-references/',
            newTab: undefined
          }
        ]
      },
      {
        description: 'Full tools built on Comfy',
        items: [
          {
            label: 'Cinematic Studio',
            href: '/hub/apps/cinematic-studio/',
            newTab: true
          },
          { label: 'Re-shoot', href: '/hub/apps/reshoot/', newTab: true }
        ]
      }
    ])
  })

  it('links every Hub entry to a page the site builds', () => {
    const hub = hubOf(getMainNavigation('en', ALL_SECTIONS))
    const built = new Set([
      '/hub/models/',
      '/hub/workflows/',
      '/hub/apps/',
      ...modelPageUrls.map(({ newSlug }) => `/hub/models/${newSlug}/`),
      ...hubWorkflowNames.map((name) => `/hub/workflows/${name}/`),
      ...hubAppNames.map((name) => `/hub/apps/${name}/`)
    ])
    const hrefs = [
      ...(hub.columns ?? []).flatMap((column) =>
        column.items.map(({ href }) => href)
      ),
      hub.featured?.cta.href
    ]

    expect(hrefs).toHaveLength(10)
    expect(hrefs.filter((href) => !href || !built.has(href))).toEqual([])
  })

  it.for(['en', 'zh-CN'] as const)(
    'features Seedance 2.5 in the Hub menu, linking to its model page, for %s',
    (locale) => {
      const featured = getMainNavigation(locale)[0].featured

      expect(featured).toEqual(
        expect.objectContaining({
          title: 'Seedance 2.5',
          imageSrc:
            'https://media.comfy.org/website/seedance-2.5/balloons-poster.webp',
          videoSrc:
            'https://media.comfy.org/website/seedance-2.5/balloons.webm',
          cta: expect.objectContaining({
            label: t('nav.featuredHubCta', {}, { locale }),
            href: '/hub/models/seedance-2-5-reference-to-video/'
          })
        })
      )
    }
  )

  it('does not expose Models as a top-level navigation item', () => {
    const labels = getMainNavigation('en').map((item) => item.label)
    expect(labels).not.toContain('Models')
  })

  it('organizes Products by Create, Automate, Build, and Resources', () => {
    const productsItem = getMainNavigation('en').find(
      (item) => item.label === 'Products'
    )

    expect(productsItem?.columns?.map((column) => column.header)).toEqual([
      'Create',
      'Automate',
      'Build',
      'Resources'
    ])
    expect(productsItem?.columns?.[0].items.map((item) => item.label)).toEqual([
      'Comfy Desktop',
      'Browse Models',
      'Comfy Cloud',
      'Comfy Workflows'
    ])
    expect(productsItem?.columns?.[2].items.map((item) => item.label)).toEqual([
      'Developer Platform',
      'Comfy API',
      'Comfy Router',
      'Builds',
      'Managed Builds'
    ])
    expect(productsItem?.columns?.[2].items).toContainEqual(
      expect.objectContaining({
        label: 'Managed Builds',
        href: '/enterprise/managed-builds/'
      })
    )
    expect(productsItem?.columns?.[3].placement).toBe('footer')
    expect(productsItem?.columns?.[3].items.map((item) => item.label)).toEqual([
      'Docs',
      'Comfy SDKs'
    ])
  })

  it.for(['en', 'zh-CN', 'ja'] as const)(
    'marks the developer products as new, never beta, for %s',
    (locale) => {
      const routes = getRoutes(locale)
      const products = getMainNavigation(locale)
        .find((item) => item.label === t('nav.products', {}, { locale }))
        ?.columns?.flatMap((column) => column.items)
      const badgeOf = (href: string) => {
        const entry = products?.find((item) => item.href === href)
        expect(entry).toBeDefined()
        return entry?.badge
      }

      expect(badgeOf(routes.platform)).toBe('new')
      expect(badgeOf(routes.platformComfyApi)).toBeUndefined()
      expect(badgeOf(routes.platformRouter)).toBe('new')
      expect(badgeOf(routes.managedBuilds)).toBeUndefined()
    }
  )

  it('places Enterprise between Products and Pricing', () => {
    const navigation = getMainNavigation('en')

    expect(navigation.map((item) => item.label)).toEqual([
      'Hub',
      'Products',
      'Enterprise',
      'Pricing',
      'Company'
    ])
    const enterprise = navigation[2]
    expect(enterprise.columns).toHaveLength(1)
    expect(enterprise.columns?.[0].header).toBeUndefined()
    expect(enterprise.columns?.[0].items.map((item) => item.label)).toEqual([
      'Comfy Enterprise',
      'Forward Deployed Creatives',
      'Team Billing',
      'Commercial Licensing',
      'Contact Sales'
    ])
    expect(enterprise.featured).toEqual(
      expect.objectContaining({
        videoSrc: 'https://media.comfy.org/website/minimax-license/hero.mp4',
        cta: expect.objectContaining({
          href: getRoutes('en').minimaxLicense
        })
      })
    )
  })

  it('folds Community into the Company menu with social icons in the footer', () => {
    const company = getMainNavigation('en').find(
      (item) => item.label === 'Company'
    )
    const labels = (index: number) =>
      company?.columns?.[index].items.map((item) => item.label)

    expect(company?.columns?.map((column) => column.header)).toEqual([
      'Community',
      'Company',
      'Updates',
      'Connect'
    ])
    expect(labels(0)).toEqual(['Events', 'Affiliates', 'Learning'])
    expect(labels(2)).toEqual(['Customer Stories', 'Launches', 'Blog'])
    expect(company?.columns?.[3].placement).toBe('footer')
    expect(company?.columns?.[3].items).toContainEqual({
      label: 'Discord',
      href: 'https://discord.com/invite/comfyorg',
      icon: '/icons/social/discord.svg',
      external: true
    })
    expect(company?.columns?.[3].items.every((item) => item.icon)).toBe(true)
    expect(company?.featured?.cta.href).toBe(
      getRoutes('en').customerVideoBlackMath
    )
  })

  it.for([
    { locale: 'en', href: '/gemini-omni/' },
    { locale: 'zh-CN', href: '/zh-CN/gemini-omni/' },
    { locale: 'ja', href: '/gemini-omni/' }
  ] as const)(
    'links the Products featured card to $href for $locale',
    ({ locale, href }) => {
      const featured = getMainNavigation(locale).find(
        (item) => item.label === t('nav.products', {}, { locale })
      )?.featured
      expect(featured?.imageSrc).toBe(
        'https://media.comfy.org/website/gemini-omni/card-5.webp'
      )
      expect(featured?.videoSrc).toBe(
        'https://media.comfy.org/website/gemini-omni/card-5.webm'
      )
      expect(featured?.cta.href).toBe(href)
    }
  )
})
