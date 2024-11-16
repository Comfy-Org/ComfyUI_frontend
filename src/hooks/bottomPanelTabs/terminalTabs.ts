import { useI18n } from 'vue-i18n'
import { markRaw } from 'vue'
import { BottomPanelExtension } from '@/types/extensionTypes'
import LogsTerminal from '@/components/bottomPanel/tabs/terminal/LogsTerminal.vue'
import CommandTerminal from '@/components/bottomPanel/tabs/terminal/CommandTerminal.vue'

export const useLogsTerminalTab = (): BottomPanelExtension => {
  const { t } = useI18n()
  return {
    id: 'logs-terminal',
    title: t('logs'),
    component: markRaw(LogsTerminal),
    type: 'vue'
  }
}

export const useCommandTerminalTab = (): BottomPanelExtension => {
  const { t } = useI18n()
  return {
    id: 'command-terminal',
    title: t('terminal'),
    component: markRaw(CommandTerminal),
    type: 'vue'
  }
}
