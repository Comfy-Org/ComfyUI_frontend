import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import type { BottomPanelExtension } from '@/types/extensionTypes'

const { mockRegisterCommand } = vi.hoisted(() => ({
  mockRegisterCommand: vi.fn()
}))

// Mock dependencies
vi.mock('@/composables/bottomPanelTabs/useShortcutsTab', () => ({
  useShortcutsTab: () => [
    {
      id: 'shortcuts-essentials',
      title: 'Essentials',
      component: {},
      type: 'vue',
      targetPanel: 'shortcuts'
    },
    {
      id: 'shortcuts-view-controls',
      title: 'View Controls',
      component: {},
      type: 'vue',
      targetPanel: 'shortcuts'
    }
  ]
}))

vi.mock('@/composables/bottomPanelTabs/useTerminalTabs', () => ({
  useLogsTerminalTab: () => ({
    id: 'logs',
    title: 'Logs',
    component: {},
    type: 'vue',
    targetPanel: 'terminal'
  }),
  useCommandTerminalTab: () => ({
    id: 'command',
    title: 'Command',
    component: {},
    type: 'vue',
    targetPanel: 'terminal'
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    registerCommand: mockRegisterCommand
  })
}))

const mockData = vi.hoisted(() => ({ isDesktop: false }))

vi.mock('@/platform/distribution/types', () => ({
  get isDesktop() {
    return mockData.isDesktop
  }
}))

describe('useBottomPanelStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockRegisterCommand.mockClear()
    mockData.isDesktop = false
  })

  it('should initialize with empty panels', () => {
    const store = useBottomPanelStore()

    expect(store.activePanel).toBeNull()
    expect(store.bottomPanelVisible).toBe(false)
    expect(store.bottomPanelTabs).toEqual([])
    expect(store.activeBottomPanelTab).toBeNull()
  })

  it('should register bottom panel tabs', () => {
    const store = useBottomPanelStore()
    const tab: BottomPanelExtension = {
      id: 'test-tab',
      title: 'Test Tab',
      component: {},
      type: 'vue',
      targetPanel: 'terminal'
    }

    store.registerBottomPanelTab(tab)

    expect(store.panels.terminal.tabs.find((t) => t.id === 'test-tab')).toEqual(
      tab
    )
    expect(store.panels.terminal.activeTabId).toBe('test-tab')
    expect(mockRegisterCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'Workspace.ToggleBottomPanelTab.test-tab',
        label: 'Toggle Test Tab Bottom Panel'
      })
    )
  })

  it('uses titleKey and id fallbacks in registered command labels', () => {
    const store = useBottomPanelStore()

    store.registerBottomPanelTab({
      id: 'title-key-tab',
      titleKey: 'panel.titleKey',
      component: {},
      type: 'vue'
    })
    store.registerBottomPanelTab({
      id: 'id-fallback-tab',
      component: {},
      type: 'vue'
    })

    expect(mockRegisterCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Toggle panel.titleKey Bottom Panel'
      })
    )
    expect(mockRegisterCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Toggle id-fallback-tab Bottom Panel'
      })
    )
  })

  it('should toggle panel visibility', () => {
    const store = useBottomPanelStore()
    const tab: BottomPanelExtension = {
      id: 'test-tab',
      title: 'Test Tab',
      component: {},
      type: 'vue',
      targetPanel: 'shortcuts'
    }

    store.registerBottomPanelTab(tab)

    // Panel should be hidden initially
    expect(store.activePanel).toBeNull()

    // Toggle should show panel
    store.togglePanel('shortcuts')
    expect(store.activePanel).toBe('shortcuts')
    expect(store.bottomPanelVisible).toBe(true)

    // Toggle again should hide panel
    store.togglePanel('shortcuts')
    expect(store.activePanel).toBeNull()
    expect(store.bottomPanelVisible).toBe(false)
  })

  it('does not open an empty panel', () => {
    const store = useBottomPanelStore()

    store.togglePanel('terminal')

    expect(store.activePanel).toBeNull()
  })

  it('should switch between panel types', () => {
    const store = useBottomPanelStore()

    const terminalTab: BottomPanelExtension = {
      id: 'terminal-tab',
      title: 'Terminal',
      component: {},
      type: 'vue',
      targetPanel: 'terminal'
    }

    const shortcutsTab: BottomPanelExtension = {
      id: 'shortcuts-tab',
      title: 'Shortcuts',
      component: {},
      type: 'vue',
      targetPanel: 'shortcuts'
    }

    store.registerBottomPanelTab(terminalTab)
    store.registerBottomPanelTab(shortcutsTab)

    // Show terminal panel
    store.togglePanel('terminal')
    expect(store.activePanel).toBe('terminal')
    expect(store.activeBottomPanelTab?.id).toBe('terminal-tab')

    // Switch to shortcuts panel
    store.togglePanel('shortcuts')
    expect(store.activePanel).toBe('shortcuts')
    expect(store.activeBottomPanelTab?.id).toBe('shortcuts-tab')
  })

  it('sets active tab only when a panel is active', () => {
    const store = useBottomPanelStore()
    store.setActiveTab('missing')
    expect(store.activeBottomPanelTabId).toBe('')

    store.registerBottomPanelTab({
      id: 'first',
      title: 'First',
      component: {},
      type: 'vue',
      targetPanel: 'shortcuts'
    })
    store.registerBottomPanelTab({
      id: 'second',
      title: 'Second',
      component: {},
      type: 'vue',
      targetPanel: 'shortcuts'
    })
    store.togglePanel('shortcuts')

    store.setActiveTab('second')
    expect(store.activeBottomPanelTab?.id).toBe('second')
  })

  it('should toggle specific tabs', () => {
    const store = useBottomPanelStore()
    const tab: BottomPanelExtension = {
      id: 'specific-tab',
      title: 'Specific Tab',
      component: {},
      type: 'vue',
      targetPanel: 'shortcuts'
    }

    store.registerBottomPanelTab(tab)

    // Toggle specific tab should show it
    store.toggleBottomPanelTab('specific-tab')
    expect(store.activePanel).toBe('shortcuts')
    expect(store.panels.shortcuts.activeTabId).toBe('specific-tab')

    // Toggle same tab again should hide panel
    store.toggleBottomPanelTab('specific-tab')
    expect(store.activePanel).toBeNull()
  })

  it('ignores toggles for unknown bottom panel tabs', () => {
    const store = useBottomPanelStore()

    store.toggleBottomPanelTab('missing-tab')

    expect(store.activePanel).toBeNull()
  })

  it('toggles terminal when available and shortcuts otherwise', () => {
    const store = useBottomPanelStore()
    const shortcutsTab: BottomPanelExtension = {
      id: 'shortcuts-tab',
      title: 'Shortcuts',
      component: {},
      type: 'vue',
      targetPanel: 'shortcuts'
    }
    const terminalTab: BottomPanelExtension = {
      id: 'terminal-tab',
      title: 'Terminal',
      component: {},
      type: 'vue',
      targetPanel: 'terminal'
    }

    store.registerBottomPanelTab(shortcutsTab)
    store.toggleBottomPanel()
    expect(store.activePanel).toBe('shortcuts')

    store.registerBottomPanelTab(terminalTab)
    store.toggleBottomPanel()
    expect(store.activePanel).toBe('terminal')
  })

  it('registers extension bottom panel tabs when present', () => {
    const store = useBottomPanelStore()

    store.registerExtensionBottomPanelTabs({
      name: 'extension',
      bottomPanelTabs: [
        {
          id: 'extension-tab',
          title: 'Extension',
          component: {},
          type: 'vue',
          targetPanel: 'shortcuts'
        }
      ]
    })

    expect(store.panels.shortcuts.tabs.map((tab) => tab.id)).toEqual([
      'extension-tab'
    ])
  })

  it('ignores extensions without bottom panel tabs', () => {
    const store = useBottomPanelStore()

    store.registerExtensionBottomPanelTabs({ name: 'extension' })

    expect(store.panels.shortcuts.tabs).toHaveLength(0)
    expect(store.panels.terminal.tabs).toHaveLength(0)
  })

  it('registers core tabs including desktop command terminal', async () => {
    mockData.isDesktop = true
    const store = useBottomPanelStore()

    await store.registerCoreBottomPanelTabs()

    expect(store.panels.shortcuts.tabs.map((tab) => tab.id)).toEqual([
      'shortcuts-essentials',
      'shortcuts-view-controls'
    ])
    expect(store.panels.terminal.tabs.map((tab) => tab.id)).toEqual([
      'logs',
      'command'
    ])
  })
})
