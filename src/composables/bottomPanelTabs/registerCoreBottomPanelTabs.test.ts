import { describe, expect, it, vi } from 'vitest'

import { registerCoreBottomPanelTabs } from '@/composables/bottomPanelTabs/registerCoreBottomPanelTabs'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import type { BottomPanelExtension } from '@/types/extensionTypes'

const stubTab = (
  id: string,
  targetPanel: BottomPanelExtension['targetPanel']
): BottomPanelExtension => ({
  id,
  title: id,
  component: {},
  type: 'vue',
  targetPanel
})

vi.mock(import('@/composables/bottomPanelTabs/useShortcutsTab'), () => ({
  useShortcutsTab: () => [
    stubTab('shortcuts-essentials', 'shortcuts'),
    stubTab('shortcuts-view-controls', 'shortcuts')
  ]
}))

vi.mock(import('@/composables/bottomPanelTabs/useTerminalTabs'), () => ({
  useLogsTerminalTab: () => stubTab('logs', 'terminal'),
  useCommandTerminalTab: () => stubTab('command', 'terminal')
}))

const distribution = vi.hoisted(() => ({ isDesktop: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isDesktop() {
    return distribution.isDesktop
  }
}))

const registeredTabIds = () => {
  const { panels } = useBottomPanelStore()
  return {
    shortcuts: panels.shortcuts.tabs.map((tab) => tab.id),
    terminal: panels.terminal.tabs.map((tab) => tab.id)
  }
}

describe('registerCoreBottomPanelTabs', () => {
  it.for([
    { isDesktop: false, terminal: ['logs'] },
    { isDesktop: true, terminal: ['logs', 'command'] }
  ])(
    'registers shortcuts and terminal tabs (isDesktop: $isDesktop)',
    async ({ isDesktop, terminal }) => {
      distribution.isDesktop = isDesktop

      await registerCoreBottomPanelTabs()

      expect(registeredTabIds()).toEqual({
        shortcuts: ['shortcuts-essentials', 'shortcuts-view-controls'],
        terminal
      })
    }
  )
})
