import { markRaw } from 'vue'
import { useI18n } from 'vue-i18n'

import EssentialsPanel from '@/components/bottomPanel/tabs/shortcuts/EssentialsPanel.vue'
import ViewControlsPanel from '@/components/bottomPanel/tabs/shortcuts/ViewControlsPanel.vue'
import { BottomPanelExtension } from '@/types/extensionTypes'

export const useShortcutsTab = (): BottomPanelExtension[] => {
  const { t } = useI18n()

  return [
    {
      id: 'shortcuts-essentials',
      title: () => t('shortcuts.essentials'), // Make it a function for reactivity
      component: markRaw(EssentialsPanel),
      type: 'vue',
      targetPanel: 'shortcuts'
    },
    {
      id: 'shortcuts-view-controls',
      title: () => t('shortcuts.viewControls'), // Make it a function for reactivity
      component: markRaw(ViewControlsPanel),
      type: 'vue',
      targetPanel: 'shortcuts'
    }
  ]
}
