import { watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { isCloud } from '@/platform/distribution/types'
import {
  LOCAL_MCP_TAB_ID,
  useLocalMcpSidebarTab
} from '@/platform/localMcp/useLocalMcpSidebarTab'
import { useLocalMcpStore } from '@/platform/localMcp/useLocalMcpStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

/**
 * Shows the Comfy MCP connect tab on local installs while the rollout flag is
 * on, and watches for the first MCP-driven job as the connection signal.
 * Never registers on Cloud, whatever the flag says.
 */
export function registerLocalMcpSurface() {
  if (isCloud) return undefined

  const sidebarTabStore = useSidebarTabStore()
  const store = useLocalMcpStore()
  const { flags } = useFeatureFlags()

  return watch(
    () => flags.localMcpConnectEnabled,
    (enabled) => {
      const registered = sidebarTabStore.sidebarTabs.some(
        (tab) => tab.id === LOCAL_MCP_TAB_ID
      )
      if (enabled && !registered) {
        sidebarTabStore.registerSidebarTab(useLocalMcpSidebarTab())
        store.trackExposed()
        store.startWatching()
      } else if (!enabled && registered) {
        sidebarTabStore.unregisterSidebarTab(LOCAL_MCP_TAB_ID)
        store.stopWatching()
      }
    },
    { immediate: true }
  )
}
