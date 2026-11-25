import { markRaw } from 'vue'

import LocalMcpSidebarTab from '@/platform/localMcp/components/LocalMcpSidebarTab.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export const LOCAL_MCP_TAB_ID = 'local-mcp'

export const useLocalMcpSidebarTab = (): SidebarTabExtension => ({
  id: LOCAL_MCP_TAB_ID,
  icon: 'icon-[lucide--plug-zap]',
  title: 'localMcp.title',
  tooltip: 'localMcp.title',
  label: 'localMcp.label',
  component: markRaw(LocalMcpSidebarTab),
  type: 'vue'
})
