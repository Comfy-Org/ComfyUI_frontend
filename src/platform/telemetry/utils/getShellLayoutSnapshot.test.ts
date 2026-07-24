import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  activeSidebarTabId: null as string | null,
  rightSidePanelOpen: false,
  bottomPanelVisible: false,
  openWorkflows: [] as unknown[]
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: (key: string) => state.settings[key] })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({ openWorkflows: state.openWorkflows })
}))

vi.mock('@/stores/workspace/bottomPanelStore', () => ({
  useBottomPanelStore: () => ({
    bottomPanelVisible: state.bottomPanelVisible
  })
}))

vi.mock('@/stores/workspace/rightSidePanelStore', () => ({
  useRightSidePanelStore: () => ({ isOpen: state.rightSidePanelOpen })
}))

vi.mock('@/stores/workspace/sidebarTabStore', () => ({
  useSidebarTabStore: () => ({
    activeSidebarTabId: state.activeSidebarTabId
  })
}))

import { getShellLayoutSnapshot } from './getShellLayoutSnapshot'

describe('getShellLayoutSnapshot', () => {
  beforeEach(() => {
    localStorage.clear()
    state.settings = { 'Comfy.UseNewMenu': 'Top' }
    state.activeSidebarTabId = null
    state.rightSidePanelOpen = false
    state.bottomPanelVisible = false
    state.openWorkflows = []
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
    state.activeSidebarTabId = 'node-library'
    state.rightSidePanelOpen = true
    state.bottomPanelVisible = true
    state.openWorkflows = [{}, {}, {}]

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
