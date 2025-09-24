import { markRaw } from 'vue'
import { useI18n } from 'vue-i18n'

import type { BottomPanelExtension } from '@/types/extensionTypes'
import EssentialsPanel from '@/workbench/keybindings/components/shortcuts/EssentialsPanel.vue'
import ViewControlsPanel from '@/workbench/keybindings/components/shortcuts/ViewControlsPanel.vue'

export const useShortcutsTab = (): BottomPanelExtension[] => {
  const { t } = useI18n()
  return [
    {
      id: 'shortcuts-essentials',
      title: t('shortcuts.essentials'), // For command labels (collected by i18n workflow)
      titleKey: 'shortcuts.essentials', // For dynamic translation in UI
      component: markRaw(EssentialsPanel),
      type: 'vue',
      targetPanel: 'shortcuts'
    },
    {
      id: 'shortcuts-view-controls',
      title: t('shortcuts.viewControls'), // For command labels (collected by i18n workflow)
      titleKey: 'shortcuts.viewControls', // For dynamic translation in UI
      component: markRaw(ViewControlsPanel),
      type: 'vue',
      targetPanel: 'shortcuts'
    }
  ]
}
