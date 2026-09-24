import { describe, expect, it } from 'vitest'

import { getRoutes } from '../config/routes'
import { getMainNavigation } from './mainNavigation'

describe('getMainNavigation', () => {
  it.for(['en', 'zh-CN', 'ja'] as const)(
    'gates both Models navigation entries for %s',
    (locale) => {
      const links = (enabled: boolean) =>
        getMainNavigation(locale, enabled).flatMap((item) =>
          item.columns
            ? item.columns.flatMap((column) =>
                column.items.map((entry) => entry.href)
              )
            : [item.href]
        )
      expect(links(false)).not.toContain('/models')
      expect(links(true).filter((href) => href === '/models')).toHaveLength(2)
    }
  )
  it('includes a Products entry linking to Enterprise Managed Builds', () => {
    const productsItem = getMainNavigation('en').find(
      (item) => item.label === 'Products'
    )
    const productsColumn = productsItem?.columns?.[0]
    const managedBuildsEntry = productsColumn?.items.find(
      (item) => item.href === getRoutes('en').managedBuilds
    )

    expect(managedBuildsEntry).toMatchObject({
      label: 'Managed Builds',
      href: '/enterprise/managed-builds'
    })
  })

  it.for([
    {
      nav: 'Products',
      imageSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webp',
      videoSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webm',
      href: getRoutes('en').geminiOmni
    },
    {
      nav: 'Community',
      imageSrc:
        'https://media.comfy.org/website/learning/advertising3-thumb.png',
      videoSrc: undefined,
      href: '/learning/ads/product-photography'
    }
  ])('features the current launch in the $nav card', (card) => {
    const featured = getMainNavigation('en').find(
      (item) => item.label === card.nav
    )?.featured
    expect(featured?.imageSrc).toBe(card.imageSrc)
    expect(featured?.videoSrc).toBe(card.videoSrc)
    expect(featured?.cta.href).toBe(card.href)
  })
})
