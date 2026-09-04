import { describe, expect, it } from 'vitest'

import { getRoutes } from '../config/routes'
import { getMainNavigation } from './mainNavigation'

describe('getMainNavigation', () => {
  it('includes a Products entry linking to Enterprise Managed Builds', () => {
    const [productsItem] = getMainNavigation('en')
    const productsColumn = productsItem.columns?.[0]
    const managedBuildsEntry = productsColumn?.items.find(
      (item) => item.href === getRoutes('en').managedBuilds
    )

    expect(managedBuildsEntry).toMatchObject({
      label: 'Enterprise Managed Builds',
      href: '/enterprise/managed-builds'
    })
  })
})
