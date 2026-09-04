import { describe, expect, it } from 'vitest'

import { getRoutes } from '../config/routes'
import { getMainNavigation } from './mainNavigation'

function workshopItem(locale: Parameters<typeof getMainNavigation>[0]) {
  return getMainNavigation(locale).find(
    (item) => item.href === getRoutes(locale).workshop
  )
}

describe('getMainNavigation workshop entry', () => {
  it('exposes Workshop as a simple top-level link, not a dropdown', () => {
    const item = workshopItem('en')
    expect(item).toBeDefined()
    expect(item?.href).toBe('/workshop')
    expect(
      item?.columns,
      'a simple link must not carry columns — both HeaderMain consumers branch on it for link-vs-dropdown rendering'
    ).toBeUndefined()
  })

  it('links to the locale-invariant /workshop path on every locale', () => {
    expect(workshopItem('en')?.href).toBe('/workshop')
    expect(workshopItem('zh-CN')?.href).toBe('/workshop')
    expect(workshopItem('ja')?.href).toBe('/workshop')
  })

  it('labels the entry Workshop, falling back to English where a locale is absent', () => {
    expect(workshopItem('en')?.label).toBe('Workshop')
    expect(workshopItem('zh-CN')?.label).toBe('Workshop')
    expect(workshopItem('ja')?.label).toBe('Workshop')
  })
})
