import { describe, expect, it, vi } from 'vitest'

import { registerCoreBottomPanelTabs } from '@/composables/bottomPanelTabs/registerCoreBottomPanelTabs'
import { useLogsTerminalTab } from '@/composables/bottomPanelTabs/useTerminalTabs'
import { reportError } from '@/platform/telemetry/reportError'
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
  useLogsTerminalTab: vi.fn(() => stubTab('logs', 'terminal')),
  useCommandTerminalTab: () => stubTab('command', 'terminal')
}))

vi.mock(import('@/platform/telemetry/reportError'))

const distribution = vi.hoisted(() => ({ isDesktop: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isDesktop() {
    return distribution.isDesktop
  }
}))

const shortcutTabIds = ['shortcuts-essentials', 'shortcuts-view-controls']

const registeredTabIds = () => {
  const { panels } = useBottomPanelStore()
  return {
    shortcuts: panels.shortcuts.tabs.map((tab) => tab.id),
    terminal: panels.terminal.tabs.map((tab) => tab.id)
  }
}

describe('registerCoreBottomPanelTabs', () => {
  it.for([
    { build: 'localhost', isDesktop: false, terminal: ['logs'] },
    { build: 'localhost', isDesktop: true, terminal: ['logs', 'command'] },
    { build: 'cloud', isDesktop: false, terminal: [] }
  ])(
    'registers shortcuts and terminal tabs (build: $build, isDesktop: $isDesktop)',
    async ({ build, isDesktop, terminal }) => {
      vi.stubGlobal('__DISTRIBUTION__', build)
      distribution.isDesktop = isDesktop

      await registerCoreBottomPanelTabs()

      expect(registeredTabIds()).toEqual({
        shortcuts: shortcutTabIds,
        terminal
      })
      expect(reportError).not.toHaveBeenCalled()
    }
  )

  it('keeps the shortcuts tabs and reports when terminal tabs fail to load', async () => {
    const failure = new Error('terminal tabs unavailable')
    vi.mocked(useLogsTerminalTab).mockImplementation(() => {
      throw failure
    })

    await registerCoreBottomPanelTabs()

    expect(registeredTabIds()).toEqual({
      shortcuts: shortcutTabIds,
      terminal: []
    })
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      errorType: 'error_loading_terminal_tabs',
      surface: 'platform'
    })
  })
})
