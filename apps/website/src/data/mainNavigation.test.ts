import { describe, expect, it } from 'vitest'

import { getRoutes } from '../config/routes'
import { getMainNavigation } from './mainNavigation'

function workshopItem(
  locale: Parameters<typeof getMainNavigation>[0],
  includeWorkshop: boolean
) {
  return getMainNavigation(locale, includeWorkshop).find(
    (item) => item.href === getRoutes(locale).workshop
  )
}

describe('getMainNavigation workshop entry', () => {
  it('omits Workshop when its routes are not in the build', () => {
    expect(workshopItem('en', false)).toBeUndefined()
  })

  it('exposes Workshop as a simple top-level link, not a dropdown', () => {
    const item = workshopItem('en', true)
    expect(item).toBeDefined()
    expect(
      item?.columns,
      'a simple link must not carry columns — both HeaderMain consumers branch on it for link-vs-dropdown rendering'
    ).toBeUndefined()
  })

  it('links to the locale-invariant /workshop path on every locale', () => {
    expect(workshopItem('en', true)?.href).toBe('/workshop')
    expect(workshopItem('zh-CN', true)?.href).toBe('/workshop')
    expect(workshopItem('ja', true)?.href).toBe('/workshop')
  })

  it('labels the entry Workshop, falling back to English where a locale is absent', () => {
    expect(workshopItem('en', true)?.label).toBe('Workshop')
    expect(workshopItem('zh-CN', true)?.label).toBe('Workshop')
    expect(workshopItem('ja', true)?.label).toBe('Workshop')
  })
})
