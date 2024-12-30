import { markRaw } from 'vue'
import { useI18n } from 'vue-i18n'

import CommandTerminal from '@/components/bottomPanel/tabs/terminal/CommandTerminal.vue'
import LogsTerminal from '@/components/bottomPanel/tabs/terminal/LogsTerminal.vue'
import { BottomPanelExtension } from '@/types/extensionTypes'

export const useLogsTerminalTab = (): BottomPanelExtension => {
  const { t } = useI18n()
  return {
    id: 'logs-terminal',
    title: t('g.logs'),
    component: markRaw(LogsTerminal),
    type: 'vue'
  }
}

export const useCommandTerminalTab = (): BottomPanelExtension => {
  const { t } = useI18n()
  return {
    id: 'command-terminal',
    title: t('g.terminal'),
    component: markRaw(CommandTerminal),
    type: 'vue'
  }
}
