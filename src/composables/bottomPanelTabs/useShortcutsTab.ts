import { markRaw } from 'vue'

import EssentialsPanel from '@/components/bottomPanel/tabs/shortcuts/EssentialsPanel.vue'
import ViewControlsPanel from '@/components/bottomPanel/tabs/shortcuts/ViewControlsPanel.vue'
import { BottomPanelExtension } from '@/types/extensionTypes'

export const useShortcutsTab = (): BottomPanelExtension[] => {
  return [
    {
      id: 'shortcuts-essentials',
      titleKey: 'shortcuts.essentials',
      component: markRaw(EssentialsPanel),
      type: 'vue',
      targetPanel: 'shortcuts'
    },
    {
      id: 'shortcuts-view-controls',
      titleKey: 'shortcuts.viewControls',
      component: markRaw(ViewControlsPanel),
      type: 'vue',
      targetPanel: 'shortcuts'
    }
  ]
}
