import { useAppMode } from '@/composables/useAppMode'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import type { ShellLayoutMetadata } from '../types'
import { getActionbarDockState } from './getActionbarDockState'

export function getShellLayoutSnapshot(): ShellLayoutMetadata {
  const { mode, isAppMode } = useAppMode()
  return {
    view_mode: mode.value,
    is_app_mode: isAppMode.value,
    dock_state: getActionbarDockState(),
    actionbar_position: useSettingStore().get('Comfy.UseNewMenu'),
    active_sidebar_tab: useSidebarTabStore().activeSidebarTabId,
    right_side_panel_open: useRightSidePanelStore().isOpen,
    bottom_panel_open: useBottomPanelStore().bottomPanelVisible,
    open_workflow_tabs: useWorkflowStore().openWorkflows.length
  }
}
