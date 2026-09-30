import { describe, expect, it } from 'vitest'

import { getRoutes } from '../config/routes'
import { t } from '../i18n/site'
import { getMainNavigation } from './mainNavigation'

describe('getMainNavigation', () => {
  it.for(['en', 'zh-CN', 'ja'] as const)(
    'gates both catalogue navigation entries for %s',
    (locale) => {
      const links = (enabled: boolean) =>
        getMainNavigation(locale, enabled).flatMap((item) =>
          item.columns
            ? item.columns.flatMap((column) =>
                column.items.map((entry) => entry.href)
              )
            : [item.href]
        )
      const catalogue = getRoutes(locale).workshop
      expect(catalogue).toBe('/hub/models/')
      expect(links(false)).not.toContain(catalogue)
      expect(links(true).filter((href) => href === catalogue)).toHaveLength(2)
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
      href: '/enterprise/managed-builds/'
    })
  })

  it.for(['en', 'zh-CN', 'ja'] as const)(
    'marks the developer products as new, never beta, for %s',
    (locale) => {
      const routes = getRoutes(locale)
      const products = getMainNavigation(locale).find(
        (item) => item.label === t('nav.products', {}, { locale: locale })
      )?.columns?.[0].items
      const badgeOf = (href: string) => {
        const entry = products?.find((item) => item.href === href)
        expect(entry).toBeDefined()
        return entry?.badge
      }

      expect(badgeOf(routes.platform)).toBe('new')
      expect(badgeOf(routes.platformRouter)).toBe('new')
      expect(badgeOf(routes.managedBuilds)).toBeUndefined()
    }
  )

  const featuredCards = [
    {
      position: 0,
      imageSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webp',
      videoSrc: 'https://media.comfy.org/website/gemini-omni/card-5.webm'
    },
    {
      position: 1,
      imageSrc:
        'https://media.comfy.org/website/learning/advertising3-thumb.png',
      videoSrc: undefined
    }
  ] as const

  it.for([
    { locale: 'en', card: featuredCards[0], href: '/gemini-omni/' },
    { locale: 'zh-CN', card: featuredCards[0], href: '/zh-CN/gemini-omni/' },
    { locale: 'ja', card: featuredCards[0], href: '/gemini-omni/' },
    {
      locale: 'en',
      card: featuredCards[1],
      href: '/learning/ads/product-photography/'
    },
    {
      locale: 'zh-CN',
      card: featuredCards[1],
      href: '/zh-CN/learning/ads/product-photography/'
    },
    {
      locale: 'ja',
      card: featuredCards[1],
      href: '/learning/ads/product-photography/'
    }
  ] as const)(
    'links the featured card to $href for $locale',
    ({ locale, card, href }) => {
      const { imageSrc, videoSrc, cta } = getMainNavigation(locale).flatMap(
        (item) => (item.featured ? [item.featured] : [])
      )[card.position]
      expect(imageSrc).toBe(card.imageSrc)
      expect(videoSrc).toBe(card.videoSrc)
      expect(cta.href).toBe(href)
    }
  )
})
