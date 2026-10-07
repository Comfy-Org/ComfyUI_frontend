import { useShortcutsTab } from '@/composables/bottomPanelTabs/useShortcutsTab'
import { isDesktop } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'

export async function registerCoreBottomPanelTabs() {
  const bottomPanelStore = useBottomPanelStore()

  for (const tab of useShortcutsTab()) {
    bottomPanelStore.registerBottomPanelTab(tab)
  }

  if (__DISTRIBUTION__ !== 'cloud') {
    try {
      const { useLogsTerminalTab, useCommandTerminalTab } =
        await import('@/composables/bottomPanelTabs/useTerminalTabs')
      bottomPanelStore.registerBottomPanelTab(useLogsTerminalTab())
      if (isDesktop) {
        bottomPanelStore.registerBottomPanelTab(useCommandTerminalTab())
      }
    } catch (error) {
      reportError(error, {
        errorType: 'error_loading_terminal_tabs',
        surface: 'platform'
      })
    }
  }
}
