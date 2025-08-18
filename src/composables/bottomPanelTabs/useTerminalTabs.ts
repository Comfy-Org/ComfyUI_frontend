import { markRaw } from 'vue'

import CommandTerminal from '@/components/bottomPanel/tabs/terminal/CommandTerminal.vue'
import LogsTerminal from '@/components/bottomPanel/tabs/terminal/LogsTerminal.vue'
import { BottomPanelExtension } from '@/types/extensionTypes'

export const useLogsTerminalTab = (): BottomPanelExtension => {
  return {
    id: 'logs-terminal',
    titleKey: 'g.logs',
    component: markRaw(LogsTerminal),
    type: 'vue'
  }
}

export const useCommandTerminalTab = (): BottomPanelExtension => {
  return {
    id: 'command-terminal',
    titleKey: 'g.terminal',
    component: markRaw(CommandTerminal),
    type: 'vue'
  }
}
