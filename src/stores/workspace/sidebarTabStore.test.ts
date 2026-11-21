import { describe, expect, it, vi } from 'vitest'

import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

vi.mock(import('@/i18n'), () => ({
  t: (key: string) => key,
  te: () => false
}))

describe('useSidebarTabStore', () => {
  const registerTab = (onToggle?: () => Promise<boolean>) => {
    const store = useSidebarTabStore()
    store.registerSidebarTab({
      id: 'tab',
      title: 'tab',
      type: 'vue',
      component: {},
      onToggle
    })
    return store
  }

  const runToggleCommand = async () => {
    const toggleCommand = useCommandStore().commands.find(
      (command) => command.id === 'Workspace.ToggleSidebarTab.tab'
    )
    await toggleCommand?.function()
  }

  describe('toggle command', () => {
    it.for([
      { hook: 'none', onToggle: undefined, activeTabId: 'tab' },
      { hook: 'declines', onToggle: async () => false, activeTabId: 'tab' },
      { hook: 'handles', onToggle: async () => true, activeTabId: null }
    ])(
      'activates the tab unless the onToggle hook handles it ($hook)',
      async ({ onToggle, activeTabId }) => {
        const store = registerTab(onToggle)

        await runToggleCommand()

        expect(store.activeSidebarTabId).toBe(activeTabId)
      }
    )
  })

  it('keeps runtime registration attribution outside the public tab shape', () => {
    const store = useSidebarTabStore()
    store.registerSidebarTab(
      {
        id: 'agent-tab',
        title: 'Agent tab',
        type: 'vue',
        component: {}
      },
      undefined,
      'agent.tools.sidebar'
    )

    expect(store.getSourceExtensionName('agent-tab')).toBe(
      'agent.tools.sidebar'
    )

    store.unregisterSidebarTab('agent-tab')
    expect(store.getSourceExtensionName('agent-tab')).toBeUndefined()
  })
})
