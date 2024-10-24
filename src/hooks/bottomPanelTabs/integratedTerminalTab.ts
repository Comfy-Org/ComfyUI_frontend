import { useI18n } from 'vue-i18n'
import { markRaw } from 'vue'
import IntegratedTerminal from '@/components/bottomPanel/tabs/IntegratedTerminal.vue'
import { BottomPanelExtension } from '@/types/extensionTypes'

export const useIntegratedTerminalTab = (): BottomPanelExtension => {
  const { t } = useI18n()
  return {
    id: 'integrated-terminal',
    title: t('terminal'),
    component: markRaw(IntegratedTerminal),
    type: 'vue'
  }
}
