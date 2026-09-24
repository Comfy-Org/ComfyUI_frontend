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
  // The V2 catalogue goes by its own name, and the nav entry that leads to the
  // live one leads to it instead while the reader is inside it.
  it('names the catalogue after the Hub on the Hub', () => {
    const [entry] = getMainNavigation('en', true, true)

    expect(entry.label).toBe('Hub')
    expect(entry.href).toBe('/hub/')
  })

  it('leaves the live catalogue named and addressed as it is', () => {
    const [entry] = getMainNavigation('en', true)

    expect(entry.label).toBe('Models')
    expect(entry.href).toBe('/models')
  })

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
})
