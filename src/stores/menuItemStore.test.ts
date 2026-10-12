import { describe, expect, it } from 'vitest'

import { useCommandStore } from '@/stores/commandStore'
import { useMenuItemStore } from '@/stores/menuItemStore'

describe('menuItemStore', () => {
  it('places the New Blank Workflow icon only at the trailing edge', () => {
    useCommandStore().registerCommand({
      id: 'Comfy.NewBlankWorkflow',
      label: 'New',
      icon: 'icon-plus',
      function: () => undefined
    })

    const item = useMenuItemStore().commandIdToMenuItem(
      'Comfy.NewBlankWorkflow'
    )

    expect(item.icon).toBeUndefined()
    expect(item.trailingIcon).toBe('icon-plus')
  })

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
