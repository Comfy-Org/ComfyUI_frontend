import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { beforeEach, describe, expect, it } from 'vitest'

import { getShellLayoutSnapshot } from './getShellLayoutSnapshot'

describe('getShellLayoutSnapshot', () => {
  beforeEach(() => {
    useSettingStore().settingValues = { 'Comfy.UseNewMenu': 'Top' }
    useSidebarTabStore().activeSidebarTabId = null
    useRightSidePanelStore().isOpen = false
    useBottomPanelStore().bottomPanelVisible = false
    Object.assign(useWorkflowStore(), { openWorkflows: [] })
  })

  it('captures the default layout', () => {
    expect(
      getShellLayoutSnapshot({ view_mode: 'graph', is_app_mode: false })
    ).toEqual({
      view_mode: 'graph',
      is_app_mode: false,
      dock_state: 'docked',
      actionbar_position: 'Top',
      active_sidebar_tab: null,
      right_side_panel_open: false,
      bottom_panel_open: false,
      open_workflow_tabs: 0
    })
  })

  it('captures a customized layout', () => {
    localStorage.setItem('Comfy.MenuPosition.Docked', 'false')
    useSidebarTabStore().activeSidebarTabId = 'node-library'
    useRightSidePanelStore().isOpen = true
    useBottomPanelStore().bottomPanelVisible = true
    Object.assign(useWorkflowStore(), { openWorkflows: [{}, {}, {}] })

    expect(
      getShellLayoutSnapshot({ view_mode: 'app', is_app_mode: true })
    ).toEqual({
      view_mode: 'app',
      is_app_mode: true,
      dock_state: 'floating',
      actionbar_position: 'Top',
      active_sidebar_tab: 'node-library',
      right_side_panel_open: true,
      bottom_panel_open: true,
      open_workflow_tabs: 3
    })
  })
})
