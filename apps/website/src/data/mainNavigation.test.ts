import { assert, describe, expect, it } from 'vitest'

import hubAppNames from '@/config/hub-app-names.json' with { type: 'json' }
import hubWorkflowNames from '@/config/hub-workflow-names.json' with { type: 'json' }
import { modelPageUrls } from '@/config/model-urls'
import { externalLinks, getRoutes } from '@/config/routes'
import { t } from '@/i18n/translations'
import type { HubSections, NavItem } from './mainNavigation'
import { getMainNavigation } from './mainNavigation'

const ALL_SECTIONS: HubSections = { workflows: true, apps: true }
const GATED_HUB_LINK = /^\/hub\/(?!models\/local\/)/

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
    'gates every Hub entry for %s',
    (locale) => {
      const links = (enabled: boolean) =>
        getMainNavigation(locale, enabled, ALL_SECTIONS).flatMap(hrefsOf)
      const { hubExplore, hubApps, hubWorkflows, workshop } = getRoutes(locale)
      const hub = [hubExplore, hubApps, hubWorkflows, workshop]
      expect(hub).toEqual([
        '/hub/',
        '/hub/apps/',
        '/hub/workflows/',
        '/hub/models/'
      ])
      expect(links(false)).toEqual(
        expect.not.arrayContaining([expect.stringMatching(GATED_HUB_LINK)])
      )
      expect(links(true)).toEqual(expect.arrayContaining(hub))
    }
  )

  it.for([
    {
      build: 'with',
      on: true,
      labels: ['Hub', 'Products', 'Enterprise', 'Pricing', 'Company']
    },
    {
      build: 'without',
      on: false,
      labels: ['Products', 'Enterprise', 'Pricing', 'Company']
    }
  ])('orders the top bar $build the workshop', ({ on, labels }) => {
    expect(
      getMainNavigation('en', on, ALL_SECTIONS).map((item) => item.label)
    ).toEqual(labels)
  })

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
      const hub = findItem(getMainNavigation('en', true, sections), 'Hub')

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
    const hub = findItem(getMainNavigation('en', true, ALL_SECTIONS), 'Hub')
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
      getMainNavigation('en', true, ALL_SECTIONS, {
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
    const hub = findItem(getMainNavigation('en', true, ALL_SECTIONS), 'Hub')
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

  it.for([
    { build: 'with', on: true, build0: [] },
    { build: 'without', on: false, build0: ['Supported Models'] }
  ])(
    'groups Products into Create, Automate and Build $build the workshop',
    ({ on, build0 }) => {
      const products = findItem(
        getMainNavigation('en', on, ALL_SECTIONS),
        'Products'
      )

      expect(
        products.columns?.map(({ header, placement, items }) => ({
          header,
          placement,
          items: items.map(({ label }) => label)
        }))
      ).toEqual([
        {
          header: 'Create',
          placement: undefined,
          items: ['Comfy Desktop', 'Comfy Cloud']
        },
        {
          header: 'Automate',
          placement: undefined,
          items: ['Comfy Agent', 'Comfy MCP', 'Comfy CLI']
        },
        {
          header: 'Build',
          placement: undefined,
          items: [
            ...build0,
            'Developer Platform',
            'Comfy API',
            'Comfy Router',
            'Builds',
            'Managed Builds'
          ]
        },
        {
          header: 'Resources',
          placement: 'footer',
          items: ['Docs', 'Comfy SDKs', 'Launches']
        }
      ])
      expect(hrefsOf(products)).toEqual(
        expect.not.arrayContaining([expect.stringMatching(GATED_HUB_LINK)])
      )
      expect(products.featured?.cta.href).toBe('/gemini-omni/')
    }
  )

  it('includes a Products entry linking to Enterprise Managed Builds', () => {
    const managedBuildsEntry = findItem(getMainNavigation('en'), 'Products')
      .columns?.flatMap((column) => column.items)
      .find((item) => item.href === getRoutes('en').managedBuilds)

    expect(managedBuildsEntry).toMatchObject({
      label: 'Managed Builds',
      href: '/enterprise/managed-builds/'
    })
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
      expect(badgeOf(routes.platformRouter)).toBe('new')
      expect(badgeOf(routes.managedBuilds)).toBeUndefined()
    }
  )

  it('splits Company into Company, Updates and Community', () => {
    const navigation = getMainNavigation('en', true, ALL_SECTIONS)
    const company = findItem(navigation, 'Company')

    expect(
      company.columns?.map(({ header, placement, items }) => [
        header,
        placement,
        items.map(({ label, href, external }) => [label, href, external])
      ])
    ).toEqual([
      [
        'Company',
        undefined,
        [
          ['About Us', '/about/', undefined],
          ['Careers', '/careers/', undefined],
          ['Contact', '/contact/', undefined]
        ]
      ],
      [
        'Updates',
        undefined,
        [
          ['Customer Stories', '/customers/', undefined],
          ['Blog', externalLinks.blog, true]
        ]
      ],
      [
        'Community',
        undefined,
        [
          ['Events', '/events/', undefined],
          ['Learning', '/learning/', undefined],
          ['Affiliates', '/affiliates/', undefined]
        ]
      ]
    ])
  })

  it('leaves the social links to the footer', () => {
    const navigation = getMainNavigation('en', true, ALL_SECTIONS)
    const social = [
      externalLinks.github,
      externalLinks.discord,
      externalLinks.x,
      externalLinks.youtube,
      externalLinks.linkedin,
      externalLinks.instagram
    ]

    for (const item of navigation)
      expect(hrefsOf(item)).toEqual(expect.not.arrayContaining(social))
    expect(navigation.flatMap(hrefsOf)).toEqual(
      expect.not.arrayContaining([
        externalLinks.reddit,
        externalLinks.workflows
      ])
    )
  })

  it('opens Enterprise as one column with a Commercial licensing card', () => {
    const enterprise = findItem(getMainNavigation('en'), 'Enterprise')

    expect(
      enterprise.columns?.map(({ header, items }) => [
        header,
        items.map(({ label, href }) => [label, href])
      ])
    ).toEqual([
      [
        'Enterprise',
        [
          ['Comfy Enterprise', '/enterprise/'],
          ['Forward Deployed Creatives', '/forward-deployed-creatives/'],
          ['Commercial licensing', '/minimax/license/'],
          ['Contact sales', '/contact/']
        ]
      ]
    ])
  })

  it.for([
    {
      locale: 'en',
      label: 'Products',
      imageSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webp',
      videoSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webm',
      href: '/gemini-omni/'
    },
    {
      locale: 'zh-CN',
      label: '产品',
      imageSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webp',
      videoSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webm',
      href: '/zh-CN/gemini-omni/'
    },
    {
      locale: 'en',
      label: 'Company',
      imageSrc: 'https://media.comfy.org/website/nav/customer-story-card.jpg',
      videoSrc: undefined,
      href: '/customers/videos/black-math/'
    },
    {
      locale: 'en',
      label: 'Enterprise',
      imageSrc:
        'https://media.comfy.org/website/gallery/amber-passage_compressed.jpg',
      videoSrc: undefined,
      href: '/minimax/license/'
    }
  ] as const)(
    'links the $label featured card to $href for $locale',
    ({ locale, label, imageSrc, videoSrc, href }) => {
      const featured = findItem(getMainNavigation(locale), label).featured

      expect(featured?.imageSrc).toBe(imageSrc)
      expect(featured?.videoSrc).toBe(videoSrc)
      expect(featured?.cta.href).toBe(href)
    }
  )
})
