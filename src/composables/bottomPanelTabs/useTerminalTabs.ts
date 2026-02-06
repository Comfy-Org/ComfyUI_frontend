import { markRaw } from 'vue'
import { useI18n } from 'vue-i18n'

import LogsTerminal from '@/components/bottomPanel/tabs/terminal/LogsTerminal.vue'
import CommandTerminal from '@/components/bottomPanel/tabs/terminal/CommandTerminal.vue'
import type { BottomPanelExtension } from '@/types/extensionTypes'

export function useLogsTerminalTab(): BottomPanelExtension {
  const { t } = useI18n()
  return {
    id: 'logs-terminal',
    title: t('g.logs'),
    titleKey: 'g.logs',
    component: markRaw(LogsTerminal),
    type: 'vue'
  }
}

export function useCommandTerminalTab(): BottomPanelExtension {
  const { t } = useI18n()
  return {
    id: 'command-terminal',
    title: t('g.terminal'),
    titleKey: 'g.terminal',
    component: markRaw(CommandTerminal),
    type: 'vue'
  }
}
