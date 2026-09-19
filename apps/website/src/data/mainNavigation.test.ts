import { describe, expect, it } from 'vitest'

import { getRoutes } from '../config/routes'
import { getMainNavigation } from './mainNavigation'

describe('getMainNavigation', () => {
  it('does not expose Models as a top-level navigation item', () => {
    expect(getMainNavigation('en').map((item) => item.label)).not.toContain(
      'Models'
    )
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
    expect(productsItem?.columns?.[2].items).toContainEqual(
      expect.objectContaining({
        label: 'Managed Builds',
        href: getRoutes('en').managedBuilds
      })
    )
    expect(productsItem?.columns?.[2].items).toContainEqual(
      expect.objectContaining({
        label: 'Comfy Router',
        href: getRoutes('en').platformRouter
      })
    )
    expect(productsItem?.columns?.[0].items.map((item) => item.label)).toEqual([
      'Comfy Desktop',
      'Comfy Cloud',
      'Comfy Workflows',
      'Supported Models'
    ])
    expect(productsItem?.columns?.[0].items[2]).toEqual({
      label: 'Comfy Workflows',
      href: 'https://comfy.org/workflows/'
    })
    expect(productsItem?.columns?.[0].items.at(-1)).toEqual({
      label: 'Supported Models',
      href: getRoutes('en').models
    })
    expect(productsItem?.columns?.[3].placement).toBe('footer')
    expect(productsItem?.columns?.[3].items.map((item) => item.label)).toEqual([
      'Docs',
      'Comfy SDKs',
      'Launches'
    ])

    const communityItem = getMainNavigation('en').find(
      (item) => item.label === 'Community'
    )
    expect(
      communityItem?.columns?.flatMap((column) =>
        column.items.map((item) => item.label)
      )
    ).not.toContain('Comfy Workflows')
    expect(communityItem?.columns?.[0].items.at(-1)).toEqual({
      label: 'Learning',
      href: getRoutes('en').learning,
      badge: 'new'
    })
  })

  it('places Enterprise between Products and Pricing', () => {
    const navigation = getMainNavigation('en')

    expect(navigation.map((item) => item.label)).toEqual([
      'Products',
      'Enterprise',
      'Pricing',
      'Community',
      'Company'
    ])
    expect(navigation[1].columns?.[0].header).toBeUndefined()
    expect(navigation[1].columns?.[0].items.map((item) => item.label)).toEqual([
      'Comfy Enterprise',
      'Forward Deployed Creatives',
      'Team Billing',
      'Commercial Licensing',
      'Contact Sales'
    ])
    expect(navigation[1].columns).toHaveLength(1)
    expect(navigation[1].featured).toEqual(
      expect.objectContaining({
        videoSrc: 'https://media.comfy.org/website/minimax-license/hero.mp4',
        title: 'MiniMax Commercial License',
        cta: expect.objectContaining({
          label: 'LEARN MORE',
          href: getRoutes('en').minimaxLicense
        })
      })
    )
    expect(navigation[1].columns?.[0].items).toContainEqual({
      label: 'Forward Deployed Creatives',
      href: getRoutes('en').fdct
    })
  })

  it('includes Customer Stories under Company updates', () => {
    const company = getMainNavigation('en').find(
      (item) => item.label === 'Company'
    )

    expect(company?.columns?.[1].items).toContainEqual(
      expect.objectContaining({
        label: 'Customer Stories',
        href: getRoutes('en').customers
      })
    )
  })
})
