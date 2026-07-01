import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import type { MenuItem } from 'primevue/menuitem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCommandStore } from '@/stores/commandStore'
import { useMenuItemStore } from '@/stores/menuItemStore'

const canvasStoreMock = vi.hoisted(() => ({ linearMode: false }))

vi.mock('@/constants/coreMenuCommands', () => ({
  CORE_MENU_COMMANDS: [[['Core'], ['core.command']]]
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandlingAsync:
      (fn: () => Promise<void>, errorHandler?: (e: unknown) => void) =>
      async () => {
        try {
          await fn()
        } catch (e) {
          if (errorHandler) errorHandler(e)
          else throw e
        }
      }
  })
}))

vi.mock('@/platform/keybindings/keybindingStore', () => ({
  useKeybindingStore: () => ({
    getKeybindingByCommandId: () => null
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => canvasStoreMock
}))

describe('menuItemStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    canvasStoreMock.linearMode = false
  })

  it('records that linear mode has been seen', () => {
    canvasStoreMock.linearMode = true

    const store = useMenuItemStore()

    expect(store.hasSeenLinear).toBe(true)
  })

  it('creates nested groups, separators, and active-state metadata', () => {
    const store = useMenuItemStore()
    const activeItem: MenuItem = {
      label: 'Active',
      comfyCommand: { id: 'active', function: vi.fn(), active: () => true }
    }
    const plainItem: MenuItem = { label: 'Plain' }

    store.registerMenuGroup(['File', 'Export'], [activeItem])
    store.registerMenuGroup(['File', 'Export'], [plainItem])

    const file = store.menuItems[0]
    const exportGroup = file.items?.[0]

    expect(file.label).toBe('File')
    expect(exportGroup?.items).toEqual([
      activeItem,
      { separator: true },
      plainItem
    ])
    expect(store.menuItemHasActiveStateChildren['File.Export']).toBe(true)
  })

  it('repairs existing group items before appending children', () => {
    const store = useMenuItemStore()
    store.menuItems.push({ label: 'Tools' })

    store.registerMenuGroup(['Tools'], [{ label: 'Child' }])

    expect(store.menuItems[0].items).toEqual([{ label: 'Child' }])
  })

  it('maps command ids to executable menu items', async () => {
    const commandStore = useCommandStore()
    const fn = vi.fn()
    commandStore.registerCommand({
      id: 'test.command',
      function: fn,
      icon: 'icon-[lucide--test]',
      label: 'Label',
      menubarLabel: 'Menu Label',
      tooltip: 'Tip'
    })

    const store = useMenuItemStore()
    const item = store.commandIdToMenuItem('test.command', ['Tools'])
    await item.command?.({ originalEvent: new Event('click'), item })

    expect(fn).toHaveBeenCalled()
    expect(item).toMatchObject({
      label: 'Menu Label',
      icon: 'icon-[lucide--test]',
      tooltip: 'Tip',
      parentPath: 'Tools'
    })
  })

  it('loads extension menu commands only for commands owned by the extension', () => {
    const commandStore = useCommandStore()
    commandStore.registerCommand({
      id: 'owned',
      function: vi.fn(),
      menubarLabel: 'Owned'
    })

    const store = useMenuItemStore()
    store.loadExtensionMenuCommands({
      name: 'extension',
      commands: [{ id: 'owned', function: vi.fn() }],
      menuCommands: [{ path: ['Tools'], commands: ['owned', 'external'] }]
    })
    store.loadExtensionMenuCommands({ name: 'plain' })
    store.loadExtensionMenuCommands({
      name: 'empty',
      menuCommands: [{ path: ['Tools'], commands: ['missing'] }]
    })

    expect(store.menuItems[0].items?.map((item) => item.label)).toEqual([
      'Owned'
    ])
  })

  it('registers core menu commands', () => {
    const commandStore = useCommandStore()
    commandStore.registerCommand({
      id: 'core.command',
      function: vi.fn(),
      menubarLabel: 'Core Command'
    })

    const store = useMenuItemStore()
    store.registerCoreMenuCommands()

    expect(store.menuItems[0].items?.[0].label).toBe('Core Command')
  })
})
