import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import type { ShellLayoutMetadata } from '@comfyorg/telemetry/types'
import { getActionbarDockState } from './getActionbarDockState'

type ShellLayoutMode = Pick<
  ShellLayoutMetadata,
  'view_mode' | 'is_app_mode' | 'right_side_panel_open'
>

export function getShellLayoutSnapshot({
  view_mode,
  is_app_mode,
  right_side_panel_open
}: ShellLayoutMode): ShellLayoutMetadata {
  return {
    view_mode,
    is_app_mode,
    dock_state: getActionbarDockState(),
    actionbar_position: useSettingStore().get('Comfy.UseNewMenu'),
    active_sidebar_tab: useSidebarTabStore().activeSidebarTabId,
    right_side_panel_open,
    bottom_panel_open: useBottomPanelStore().bottomPanelVisible,
    open_workflow_tabs: useWorkflowStore().openWorkflows.length
  }
}
