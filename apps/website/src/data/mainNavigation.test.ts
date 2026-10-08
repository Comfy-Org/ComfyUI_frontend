import { assert, describe, expect, it } from 'vitest'

import hubAppNames from '@/config/hub-app-names.json' with { type: 'json' }
import hubWorkflowNames from '@/config/hub-workflow-names.json' with { type: 'json' }
import { modelPageUrls } from '@/config/model-urls'
import { getRoutes } from '@/config/routes'
import { t } from '@/i18n/translations'
import type { HubSections, NavItem } from './mainNavigation'
import { getMainNavigation } from './mainNavigation'

const ALL_SECTIONS: HubSections = { workflows: true, apps: true }

function hrefsOf(item: NavItem): string[] {
  if (!item.columns) return [item.href]
  return [
    ...item.columns.flatMap((column) => column.items.map(({ href }) => href)),
    ...(item.exploreLink ? [item.exploreLink.href] : [])
  ]
}

function findItem(navigation: NavItem[], label: string): NavItem {
  const item = navigation.find((entry) => entry.label === label)
  if (!item) throw new Error(`${label} is missing from the navigation`)
  return item
}

describe('getMainNavigation', () => {
  it.for(['en', 'zh-CN', 'ja'] as const)(
    'links the Hub catalogue from the Hub menu and under Products > Create, for %s',
    (locale) => {
      const navigation = getMainNavigation(locale, ALL_SECTIONS)
      const { hubExplore, hubApps, hubWorkflows, workshop } = getRoutes(locale)
      const create = navigation
        .find((item) => item.label === t('nav.products', {}, { locale }))
        ?.columns?.find(
          (column) => column.header === t('nav.colCreate', {}, { locale })
        )

      expect([hubExplore, hubApps, hubWorkflows, workshop]).toEqual([
        '/hub/',
        '/hub/apps/',
        '/hub/workflows/',
        '/hub/models/'
      ])
      expect(navigation[0].label).toBe(t('nav.workshop', {}, { locale }))
      expect(hrefsOf(navigation[0])).toEqual(
        expect.arrayContaining([hubExplore, hubApps, hubWorkflows, workshop])
      )
      expect(create?.items).toContainEqual({
        label: t('nav.comfyWorkshop', {}, { locale }),
        href: workshop,
        badge: 'new'
      })
    }
  )

  it.for([
    { sections: { workflows: false, apps: false }, headers: ['Models'] },
    {
      sections: { workflows: true, apps: false },
      headers: ['Models', 'Workflows']
    },
    { sections: { workflows: false, apps: true }, headers: ['Models', 'Apps'] },
    { sections: ALL_SECTIONS, headers: ['Models', 'Workflows', 'Apps'] }
  ])(
    'opens the Hub as one column per format, showing $headers',
    ({ sections, headers }) => {
      const hub = findItem(getMainNavigation('en', sections), 'Hub')

      expect(hub.href).toBeUndefined()
      expect(hub.badge).toBe('new')
      expect(hub.columns?.map((column) => column.header)).toEqual(headers)
      expect(hub.exploreLink).toEqual({
        label: 'Explore the Hub',
        intro: 'Try in the browser, call by API, or take it into ComfyUI',
        href: '/hub/'
      })
      expect(hub.activePathPrefix).toBe('/hub/')
    }
  )

  it('shows two examples and an All link in each Hub column', () => {
    const hub = findItem(getMainNavigation('en', ALL_SECTIONS), 'Hub')
    const routes = getRoutes('en')

    expect(
      hub.columns?.map(({ kind, description, items }) => ({
        kind,
        description,
        items: items.map(({ label, href, seeAll }) => ({ label, href, seeAll }))
      }))
    ).toEqual([
      {
        kind: 'model',
        description: 'Run, call by API or download',
        items: [
          {
            label: 'Seedream 5.0 Pro',
            href: '/hub/models/seedream-5-0-pro-text-to-image/',
            seeAll: undefined
          },
          {
            label: 'Seedance 2.5',
            href: '/hub/models/seedance-2-5-reference-to-video/',
            seeAll: undefined
          },
          {
            label: 'Nano Banana 2',
            href: '/hub/models/nano-banana-2-image-edit/',
            seeAll: undefined
          },
          {
            label: 'GPT Image 2',
            href: '/hub/models/gpt-image-2-text-to-image/',
            seeAll: undefined
          },
          { label: 'All models', href: routes.workshop, seeAll: true }
        ]
      },
      {
        kind: 'workflow',
        description: 'Open one and make it yours',
        items: [
          {
            label: 'Change material',
            href: '/hub/workflows/change-material/',
            seeAll: undefined
          },
          {
            label: 'Match lighting',
            href: '/hub/workflows/match-lighting/',
            seeAll: undefined
          },
          { label: 'All workflows', href: routes.hubWorkflows, seeAll: true }
        ]
      },
      {
        kind: 'app',
        description: 'One job each, no nodes',
        items: [
          {
            label: 'Cinematic Studio',
            href: routes.cinematicStudio,
            seeAll: undefined
          },
          { label: 'Re-shoot', href: routes.reshoot, seeAll: undefined },
          { label: 'All apps', href: routes.hubApps, seeAll: true }
        ]
      }
    ])
  })

  it('shows a catalogue preview beside each Hub example, never beside an All link', () => {
    const preview = { meta: 'M' }
    const hub = findItem(
      getMainNavigation('en', ALL_SECTIONS, {
        '/hub/models/seedance-2-5-reference-to-video/': preview,
        '/hub/models/': preview,
        '/hub/apps/reshoot/': { meta: 'Only a summary' }
      }),
      'Hub'
    )
    const previews = Object.fromEntries(
      (hub.columns ?? [])
        .flatMap((column) => column.items)
        .map(({ href, meta }) => [href, { meta }])
    )

    expect(previews['/hub/models/seedance-2-5-reference-to-video/']).toEqual(
      preview
    )
    expect(previews['/hub/apps/reshoot/']).toEqual({ meta: 'Only a summary' })
    expect(previews['/hub/models/seedream-5-0-pro-text-to-image/']).toEqual({
      meta: undefined
    })
    expect(previews['/hub/models/']).toEqual({ meta: undefined })
  })

  it('links the Hub examples to pages the site builds', () => {
    const hub = findItem(getMainNavigation('en', ALL_SECTIONS), 'Hub')
    const built = new Set([
      ...modelPageUrls.map(({ newSlug }) => `/hub/models/${newSlug}/`),
      ...hubWorkflowNames.map((name) => `/hub/workflows/${name}/`),
      ...hubAppNames.map((name) => `/hub/apps/${name}/`)
    ])
    const examples = (hub.columns ?? [])
      .flatMap((column) => column.items)
      .filter((item) => !item.seeAll)

    expect(examples).toHaveLength(8)
    for (const { href } of examples) expect(built).toContain(href)
  })

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
      assert(products, 'Products menu is missing')
      const badgeOf = (href: string) => {
        const entry = products.find((item) => item.href === href)
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
