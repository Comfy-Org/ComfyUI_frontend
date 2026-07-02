import { beforeEach, describe, expect, it, vi } from 'vitest'

const { settings, workflows } = vi.hoisted(() => ({
  settings: { tabsPosition: 'Sidebar' },
  workflows: { openWorkflows: [] as unknown[] }
}))

vi.mock('@/components/sidebar/tabs/WorkflowsSidebarTab.vue', () => ({
  default: {}
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn(() => settings.tabsPosition)
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    openWorkflows: workflows.openWorkflows
  })
}))

describe('useWorkflowsSidebarTab', () => {
  beforeEach(() => {
    settings.tabsPosition = 'Sidebar'
    workflows.openWorkflows = []
  })

  it('hides the badge when workflow tabs are not in the sidebar', async () => {
    settings.tabsPosition = 'Topbar'
    workflows.openWorkflows = [{ path: 'a' }]
    const { useWorkflowsSidebarTab } = await import('./useWorkflowsSidebarTab')

    const sidebarTab = useWorkflowsSidebarTab()

    expect((sidebarTab.iconBadge as () => string | null)()).toBeNull()
  })

  it('hides the badge when no workflows are open', async () => {
    const { useWorkflowsSidebarTab } = await import('./useWorkflowsSidebarTab')

    const sidebarTab = useWorkflowsSidebarTab()

    expect((sidebarTab.iconBadge as () => string | null)()).toBeNull()
  })

  it('shows the open workflow count for sidebar tabs', async () => {
    workflows.openWorkflows = [{ path: 'a' }, { path: 'b' }]
    const { useWorkflowsSidebarTab } = await import('./useWorkflowsSidebarTab')

    const sidebarTab = useWorkflowsSidebarTab()

    expect((sidebarTab.iconBadge as () => string | null)()).toBe('2')
  })
})
