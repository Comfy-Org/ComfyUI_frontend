import { assert, describe, expect, it } from 'vitest'

import { apiKeysLink, externalLinks, getRoutes } from '@/config/routes'
import { t } from '@/i18n/translations'
import type { HubSections, NavItem } from './mainNavigation'
import { getMainNavigation } from './mainNavigation'

const ALL_SECTIONS: HubSections = { workflows: true, apps: true }

function hrefsOf(item: NavItem): string[] {
  if (!item.columns) return [item.href]
  return [
    ...item.columns.flatMap((column) => column.items.map(({ href }) => href)),
    ...(item.footerLink ? [item.footerLink.href] : [])
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
        expect.not.arrayContaining([expect.stringMatching(/^\/hub\//)])
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
      expect(hub.footerLink).toEqual({
        label: 'Explore the Hub',
        description: 'Search everything, see what’s popular and new',
        href: '/hub/'
      })
      expect(hub.activePathPrefix).toBe('/hub/')
    }
  )

  it('links each Hub column to its format', () => {
    const hub = findItem(getMainNavigation('en', true, ALL_SECTIONS), 'Hub')
    const routes = getRoutes('en')

    expect(
      hub.columns?.map(({ kind, description, items }) => ({
        kind,
        description,
        items: items.map(({ label, href, external }) => ({
          label,
          href,
          external
        }))
      }))
    ).toEqual([
      {
        kind: 'model',
        description: 'Run them here, call them by API or download them.',
        items: [
          { label: 'Browse models', href: routes.workshop },
          {
            label: 'Get an API key',
            href: apiKeysLink({ onboarding: 'router' })
          },
          {
            label: 'API docs',
            href: externalLinks.docsComfyRouter,
            external: true
          }
        ]
      },
      {
        kind: 'workflow',
        description:
          'Open one, change any step, run it in Cloud or download it.',
        items: [{ label: 'All workflows', href: routes.hubWorkflows }]
      },
      {
        kind: 'app',
        description: 'One job each, no nodes needed.',
        items: [
          { label: 'Cinematic Studio', href: routes.cinematicStudio },
          { label: 'Re-shoot', href: routes.reshoot },
          { label: 'All apps', href: routes.hubApps }
        ]
      }
    ])
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
        expect.not.arrayContaining([expect.stringMatching(/^\/hub\//)])
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

  it('folds Community into Company and keeps social links out of the menus', () => {
    const navigation = getMainNavigation('en', true, ALL_SECTIONS)
    const company = findItem(navigation, 'Company')

    expect(
      company.columns?.map(({ header, items }) => [
        header,
        items.map(({ label, href }) => [label, href])
      ])
    ).toEqual([
      [
        'Company',
        [
          ['About Us', '/about/'],
          ['Careers', '/careers/'],
          ['Contact', '/contact/'],
          ['Blog', externalLinks.blog]
        ]
      ],
      [
        'Community',
        [
          ['Customer Stories', '/customers/'],
          ['Events', '/events/'],
          ['Learning', '/learning/'],
          ['Affiliates', '/affiliates/']
        ]
      ]
    ])
    expect(navigation.flatMap(hrefsOf)).toEqual(
      expect.not.arrayContaining([
        externalLinks.discord,
        externalLinks.github,
        externalLinks.youtube,
        externalLinks.reddit,
        externalLinks.x,
        externalLinks.instagram,
        externalLinks.workflows
      ])
    )
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
