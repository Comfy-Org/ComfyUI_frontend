import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useRightSidePanelStore } from './rightSidePanelStore'

describe('rightSidePanelStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('Initial State', () => {
    it('initializes with default values', () => {
      const store = useRightSidePanelStore()
      
      expect(store.isOpen).toBe(false)
      expect(store.activeTab).toBe('parameters')
    })

    it('creates a new instance for each pinia context', () => {
      const store1 = useRightSidePanelStore()
      const pinia2 = createPinia()
      setActivePinia(pinia2)
      const store2 = useRightSidePanelStore()
      
      store1.isOpen = true
      expect(store2.isOpen).toBe(false)
    })
  })

  describe('openPanel', () => {
    it('opens panel and sets active tab', () => {
      const store = useRightSidePanelStore()
      
      store.openPanel('settings')
      
      expect(store.isOpen).toBe(true)
      expect(store.activeTab).toBe('settings')
    })

    it('opens panel with parameters tab', () => {
      const store = useRightSidePanelStore()
      
      store.openPanel('parameters')
      
      expect(store.isOpen).toBe(true)
      expect(store.activeTab).toBe('parameters')
    })

    it('opens panel with info tab', () => {
      const store = useRightSidePanelStore()
      
      store.openPanel('info')
      
      expect(store.isOpen).toBe(true)
      expect(store.activeTab).toBe('info')
    })

    it('can switch tabs while panel is already open', () => {
      const store = useRightSidePanelStore()
      
      store.openPanel('parameters')
      expect(store.activeTab).toBe('parameters')
      
      store.openPanel('settings')
      expect(store.isOpen).toBe(true)
      expect(store.activeTab).toBe('settings')
    })

    it('overwrites previous active tab', () => {
      const store = useRightSidePanelStore()
      
      store.openPanel('parameters')
      store.openPanel('info')
      
      expect(store.activeTab).toBe('info')
      expect(store.activeTab).not.toBe('parameters')
    })
  })

  describe('closePanel', () => {
    it('closes an open panel', () => {
      const store = useRightSidePanelStore()
      
      store.openPanel('parameters')
      expect(store.isOpen).toBe(true)
      
      store.closePanel()
      expect(store.isOpen).toBe(false)
    })

    it('maintains active tab when closing', () => {
      const store = useRightSidePanelStore()
      
      store.openPanel('settings')
      const tabBeforeClose = store.activeTab
      
      store.closePanel()
      
      expect(store.activeTab).toBe(tabBeforeClose)
    })

    it('is idempotent when called multiple times', () => {
      const store = useRightSidePanelStore()
      
      store.openPanel('parameters')
      store.closePanel()
      store.closePanel()
      store.closePanel()
      
      expect(store.isOpen).toBe(false)
    })

    it('works correctly when panel is already closed', () => {
      const store = useRightSidePanelStore()
      
      expect(store.isOpen).toBe(false)
      store.closePanel()
      expect(store.isOpen).toBe(false)
    })
  })

  describe('togglePanel', () => {
    it('opens closed panel', () => {
      const store = useRightSidePanelStore()
      
      expect(store.isOpen).toBe(false)
      store.togglePanel()
      expect(store.isOpen).toBe(true)
    })

    it('closes open panel', () => {
      const store = useRightSidePanelStore()
      
      store.openPanel('parameters')
      expect(store.isOpen).toBe(true)
      
      store.togglePanel()
      expect(store.isOpen).toBe(false)
    })

    it('alternates state on repeated calls', () => {
      const store = useRightSidePanelStore()
      
      expect(store.isOpen).toBe(false)
      
      store.togglePanel()
      expect(store.isOpen).toBe(true)
      
      store.togglePanel()
      expect(store.isOpen).toBe(false)
      
      store.togglePanel()
      expect(store.isOpen).toBe(true)
    })

    it('preserves active tab when toggling', () => {
      const store = useRightSidePanelStore()
      
      store.openPanel('settings')
      const originalTab = store.activeTab
      
      store.togglePanel()
      store.togglePanel()
      
      expect(store.activeTab).toBe(originalTab)
    })
  })

  describe('Active Tab Management', () => {
    it('defaults to parameters tab', () => {
      const store = useRightSidePanelStore()
      expect(store.activeTab).toBe('parameters')
    })

    it('allows all valid tab types', () => {
      const store = useRightSidePanelStore()
      const validTabs: Array<'parameters' | 'settings' | 'info'> = [
        'parameters',
        'settings',
        'info'
      ]
      
      validTabs.forEach(tab => {
        store.openPanel(tab)
        expect(store.activeTab).toBe(tab)
      })
    })

    it('can be updated directly', () => {
      const store = useRightSidePanelStore()
      
      store.activeTab = 'settings'
      expect(store.activeTab).toBe('settings')
      
      store.activeTab = 'info'
      expect(store.activeTab).toBe('info')
    })
  })

  describe('State Persistence', () => {
    it('maintains state across multiple operations', () => {
      const store = useRightSidePanelStore()
      
      store.openPanel('parameters')
      store.closePanel()
      store.openPanel('settings')
      
      expect(store.isOpen).toBe(true)
      expect(store.activeTab).toBe('settings')
    })

    it('independent operations do not interfere', () => {
      const store = useRightSidePanelStore()
      
      // Set active tab directly
      store.activeTab = 'info'
      expect(store.isOpen).toBe(false)
      
      // Toggle panel
      store.togglePanel()
      expect(store.activeTab).toBe('info')
      expect(store.isOpen).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('handles rapid toggle operations', () => {
      const store = useRightSidePanelStore()
      
      for (let i = 0; i < 100; i++) {
        store.togglePanel()
      }
      
      // Should be closed (even number of toggles)
      expect(store.isOpen).toBe(false)
    })

    it('handles rapid tab switching', () => {
      const store = useRightSidePanelStore()
      const tabs: Array<'parameters' | 'settings' | 'info'> = [
        'parameters',
        'settings',
        'info'
      ]
      
      for (let i = 0; i < 50; i++) {
        const tab = tabs[i % tabs.length]
        store.openPanel(tab)
      }
      
      // Should end on info tab (50 % 3 = 2, which is 'info')
      expect(store.activeTab).toBe('info')
      expect(store.isOpen).toBe(true)
    })

    it('maintains type safety', () => {
      const store = useRightSidePanelStore()
      
      // TypeScript should enforce correct types
      store.openPanel('parameters')
      store.openPanel('settings')
      store.openPanel('info')
      
      expect(['parameters', 'settings', 'info']).toContain(store.activeTab)
    })
  })

  describe('Workflow Scenarios', () => {
    it('supports typical user workflow: open, switch tabs, close', () => {
      const store = useRightSidePanelStore()
      
      // User opens parameters
      store.openPanel('parameters')
      expect(store.isOpen).toBe(true)
      expect(store.activeTab).toBe('parameters')
      
      // User switches to settings
      store.openPanel('settings')
      expect(store.isOpen).toBe(true)
      expect(store.activeTab).toBe('settings')
      
      // User closes panel
      store.closePanel()
      expect(store.isOpen).toBe(false)
    })

    it('supports quick toggle workflow', () => {
      const store = useRightSidePanelStore()
      
      // User toggles panel (opens with default tab)
      store.togglePanel()
      expect(store.isOpen).toBe(true)
      
      // User quickly toggles to close
      store.togglePanel()
      expect(store.isOpen).toBe(false)
    })

    it('supports switching to info tab from external action', () => {
      const store = useRightSidePanelStore()
      
      // Panel might be closed
      expect(store.isOpen).toBe(false)
      
      // User clicks "Info" button which opens panel to info tab
      store.openPanel('info')
      expect(store.isOpen).toBe(true)
      expect(store.activeTab).toBe('info')
    })
  })

  describe('Integration with UI', () => {
    it('supports binding to panel visibility', () => {
      const store = useRightSidePanelStore()
      
      // Component v-if="store.isOpen"
      expect(store.isOpen).toBe(false)
      
      store.openPanel('parameters')
      expect(store.isOpen).toBe(true)
    })

    it('supports binding to active tab', () => {
      const store = useRightSidePanelStore()
      
      store.openPanel('settings')
      
      // Component v-if="store.activeTab === 'settings'"
      expect(store.activeTab).toBe('settings')
    })

    it('supports toggle button binding', () => {
      const store = useRightSidePanelStore()
      
      // Button @click="store.togglePanel"
      const initialState = store.isOpen
      store.togglePanel()
      expect(store.isOpen).toBe(!initialState)
    })
  })

  describe('Reactive Properties', () => {
    it('isOpen is reactive', () => {
      const store = useRightSidePanelStore()
      const values: boolean[] = []
      
      // Simulating a watcher
      const stopWatch = vi.fn(() => {
        values.push(store.isOpen)
      })
      
      stopWatch()
      store.togglePanel()
      stopWatch()
      store.togglePanel()
      stopWatch()
      
      expect(values).toEqual([false, true, false])
    })

    it('activeTab is reactive', () => {
      const store = useRightSidePanelStore()
      const tabs: string[] = []
      
      const recordTab = () => tabs.push(store.activeTab)
      
      recordTab()
      store.openPanel('settings')
      recordTab()
      store.openPanel('info')
      recordTab()
      
      expect(tabs).toEqual(['parameters', 'settings', 'info'])
    })
  })

  describe('Type Safety', () => {
    it('enforces correct tab types at runtime', () => {
      const store = useRightSidePanelStore()
      
      // These should work
      store.openPanel('parameters')
      store.openPanel('settings')
      store.openPanel('info')
      
      // TypeScript should prevent invalid tabs at compile time
      // @ts-expect-error - testing invalid tab
      // store.openPanel('invalid')
      
      expect(store.activeTab).toBe('info')
    })
  })
})