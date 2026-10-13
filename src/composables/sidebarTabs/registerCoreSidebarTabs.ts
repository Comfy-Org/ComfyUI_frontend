import { watch } from 'vue'

import { useAssetsSidebarTab } from '@/composables/sidebarTabs/useAssetsSidebarTab'
import { useJobHistorySidebarTab } from '@/composables/sidebarTabs/useJobHistorySidebarTab'
import { useModelLibrarySidebarTab } from '@/composables/sidebarTabs/useModelLibrarySidebarTab'
import { useNodeLibrarySidebarTab } from '@/composables/sidebarTabs/useNodeLibrarySidebarTab'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useAppsSidebarTab } from '@/platform/workflow/management/composables/useAppsSidebarTab'
import { useWorkflowsSidebarTab } from '@/platform/workflow/management/composables/useWorkflowsSidebarTab'
import { useMenuItemStore } from '@/stores/menuItemStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

export function registerCoreSidebarTabs() {
  const sidebarTabStore = useSidebarTabStore()
  const settingStore = useSettingStore()
  const jobHistoryTabId = 'job-history'
  const syncJobHistoryTab = (enabled: boolean) => {
    const hasJobHistoryTab = sidebarTabStore.sidebarTabs.some(
      (tab) => tab.id === jobHistoryTabId
    )
    if (enabled && !hasJobHistoryTab) {
      sidebarTabStore.registerSidebarTab(useJobHistorySidebarTab(), {
        prepend: true
      })
    } else if (!enabled && hasJobHistoryTab) {
      sidebarTabStore.unregisterSidebarTab(jobHistoryTabId)
    }
  }

  syncJobHistoryTab(settingStore.get('Comfy.Queue.QPOV2'))
  watch(
    () => settingStore.get('Comfy.Queue.QPOV2'),
    (enabled) => syncJobHistoryTab(enabled)
  )

  sidebarTabStore.registerSidebarTab(useAssetsSidebarTab())
  sidebarTabStore.registerSidebarTab(useNodeLibrarySidebarTab())
  sidebarTabStore.registerSidebarTab(useModelLibrarySidebarTab())
  sidebarTabStore.registerSidebarTab(useWorkflowsSidebarTab())
  sidebarTabStore.registerSidebarTab(useAppsSidebarTab())

  const menuStore = useMenuItemStore()

  menuStore.registerCommands(
    ['View'],
    [
      'Workspace.ToggleBottomPanel',
      'Comfy.BrowseTemplates',
      'Workspace.ToggleFocusMode',
      'Comfy.ToggleCanvasInfo',
      'Comfy.Canvas.ToggleMinimap',
      'Comfy.Canvas.ToggleLinkVisibility'
    ]
  )

  menuStore.registerCommands(
    ['View'],
    ['Comfy.Canvas.ZoomIn', 'Comfy.Canvas.ZoomOut', 'Comfy.Canvas.FitView']
  )
}
