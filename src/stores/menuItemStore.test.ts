import { describe, expect, it } from 'vitest'

import { useMenuItemStore } from '@/stores/menuItemStore'

describe('menuItemStore', () => {
  it('drops action-only fields when converting an item to a submenu', () => {
    const store = useMenuItemStore()
    store.menuItems.push({
      label: 'Group',
      radioGroup: {
        value: 'first',
        options: [{ value: 'first', label: 'First', command: () => undefined }]
      }
    })

    store.registerMenuGroup(
      ['Group'],
      [{ key: 'child', label: 'Child', command: () => undefined }]
    )

    expect(store.menuItems[0]).toMatchObject({
      label: 'Group',
      items: [{ key: 'child', label: 'Child' }]
    })
    expect(store.menuItems[0]).not.toHaveProperty('radioGroup')
  })
})
