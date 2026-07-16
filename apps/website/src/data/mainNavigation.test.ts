import { describe, expect, it } from 'vitest'

import type { NavItem } from './mainNavigation'
import { getMainNavigation } from './mainNavigation'

function getColumns(item: NavItem) {
  if (!item.columns) throw new Error(`${item.label} must be a dropdown`)
  return item.columns
}

describe('getMainNavigation', () => {
  const navigation = getMainNavigation('en')

  it('uses the approved top-level order', () => {
    expect(navigation.map((item) => item.label)).toEqual([
      'Products',
      'Resources',
      'Enterprise',
      'Pricing'
    ])
  })

  it('limits Products to usable products grouped by Create and Build', () => {
    const columns = getColumns(navigation[0])

    expect(columns.map((column) => column.header)).toEqual(['Create', 'Build'])
    expect(
      columns.flatMap((column) => column.items.map((item) => item.label))
    ).toEqual(['Comfy Desktop', 'Comfy Cloud', 'Comfy API', 'Comfy MCP'])
  })

  it('organizes Resources into Learn, Discover, Stay current, and Community', () => {
    const columns = getColumns(navigation[1])

    expect(
      columns.map((column) => [
        column.header,
        column.items.map((item) => item.label)
      ])
    ).toEqual([
      ['Learn', ['Learning', 'Docs', 'Blog', 'YouTube']],
      ['Discover', ['Comfy Hub', 'Gallery', 'Supported Models']],
      ['Stay current', ["What's New", 'Customer Stories']],
      ['Community', ['Affiliate Program', 'Discord', 'GitHub']]
    ])
    expect(columns[2].items[0].href).toBe('/launches')
  })

  it('builds Enterprise as a compact buyer hub', () => {
    const columns = getColumns(navigation[2])

    expect(
      columns.map((column) => [
        column.header,
        column.items.map((item) => item.label)
      ])
    ).toEqual([
      ['Evaluate', ['Enterprise Overview', 'Customer Stories']],
      ['Contact', ['Contact Sales', 'Support']]
    ])
    expect(columns[0].items[0].href).toBe('/cloud/enterprise')
    expect(columns[1].items[0].href).toBe('/contact')
  })

  it('includes Customer Stories in both discovery and buying journeys', () => {
    const customerStoryPlacements = navigation
      .flatMap((item) => item.columns ?? [])
      .flatMap((column) => column.items)
      .filter((item) => item.analyticsId === 'customer-stories')

    expect(customerStoryPlacements).toHaveLength(2)
    expect(
      customerStoryPlacements.every((item) => item.href === '/customers')
    ).toBe(true)
    expect(customerStoryPlacements[0].contributesToParentActive).toBe(false)
    expect(customerStoryPlacements[1].contributesToParentActive).toBeUndefined()
  })
})
