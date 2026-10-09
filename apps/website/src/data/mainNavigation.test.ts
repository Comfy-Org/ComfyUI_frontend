import { describe, expect, it } from 'vitest'

import { getRoutes } from '@/config/routes'
import { t } from '@/i18n/translations'
import { getMainNavigation } from './mainNavigation'

describe('getMainNavigation', () => {
  it.for(['en', 'zh-CN', 'ja'] as const)(
    'links the Hub catalogue at the top level and under Products > Create, for %s',
    (locale) => {
      const navigation = getMainNavigation(locale)
      const catalogue = getRoutes(locale).workshop
      const create = navigation
        .find((item) => item.label === t('nav.products', {}, { locale }))
        ?.columns?.find(
          (column) => column.header === t('nav.colCreate', {}, { locale })
        )

      expect(catalogue).toBe('/hub/models/')
      expect(navigation[0]).toEqual({
        label: t('nav.workshop', {}, { locale }),
        href: catalogue
      })
      expect(create?.items).toContainEqual({
        label: t('nav.comfyWorkshop', {}, { locale }),
        href: catalogue,
        badge: 'new'
      })
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
