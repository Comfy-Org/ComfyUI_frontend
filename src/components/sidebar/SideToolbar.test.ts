import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import SideToolbar from './SideToolbar.vue'

interface TestTab {
  id: string
  icon: string
  tooltip: string
  label: string
  title: string
}

const spies = vi.hoisted(() => ({
  trackUiButtonClicked: vi.fn(),
  toggleAssets: vi.fn()
}))

const state = vi.hoisted(() => ({
  isMultiUserServer: false,
  sidebarTabs: [] as TestTab[],
  activeSidebarTab: null as { id: string } | null
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isDesktop: false,
  isNightly: false
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => ({
    getSidebarTabs: () => state.sidebarTabs,
    sidebarTab: { activeSidebarTab: state.activeSidebarTab }
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => {
      if (key === 'Comfy.Sidebar.Size') return 'large'
      if (key === 'Comfy.Sidebar.Location') return 'left'
      return 'floating'
    }
  })
}))

vi.mock('@/stores/userStore', () => ({
  useUserStore: () => ({ isMultiUserServer: state.isMultiUserServer })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    commands: [
      { id: 'Workspace.ToggleSidebarTab.assets', function: spies.toggleAssets }
    ]
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ canvas: null })
}))

vi.mock('@/platform/keybindings/keybindingStore', () => ({
  useKeybindingStore: () => ({ getKeybindingByCommandId: () => undefined })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackUiButtonClicked: spies.trackUiButtonClicked })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

type SideToolbarProps = ComponentProps<typeof SideToolbar>

function renderToolbar(props: SideToolbarProps = {}) {
  return render(SideToolbar, {
    props,
    global: {
      plugins: [PrimeVue, i18n],
      directives: { tooltip: {} },
      stubs: {
        ComfyMenuButton: { template: '<div />' },
        SidebarTemplatesButton: { template: '<div />' },
        SidebarLogoutIcon: { template: '<div data-testid="logout" />' },
        SidebarHelpCenterIcon: { template: '<div />' },
        SidebarSettingsButton: { template: '<div />' },
        HelpCenterPopups: { template: '<div />' },
        SidebarBottomPanelToggleButton: {
          template: '<div data-testid="bottom-panel-toggle" />'
        },
        SidebarShortcutsToggleButton: {
          template: '<div data-testid="shortcuts-toggle" />'
        }
      }
    }
  })
}

const assetsTab: TestTab = {
  id: 'assets',
  icon: 'pi pi-image',
  tooltip: 'Assets',
  label: 'Assets',
  title: 'Assets'
}

const workflowsTab: TestTab = {
  id: 'workflows',
  icon: 'pi pi-folder',
  tooltip: 'Workflows',
  label: 'Workflows',
  title: 'Workflows'
}

describe('SideToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.isMultiUserServer = false
    state.sidebarTabs = [assetsTab, workflowsTab]
    state.activeSidebarTab = null
  })

  it('renders only the tabs listed in visibleTabIds', () => {
    renderToolbar({ visibleTabIds: ['assets'] })

    expect(screen.getByRole('button', { name: 'Assets' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Workflows' })
    ).not.toBeInTheDocument()
  })

  it('renders all sidebar tabs when visibleTabIds is omitted', () => {
    renderToolbar()

    expect(screen.getByRole('button', { name: 'Assets' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Workflows' })
    ).toBeInTheDocument()
  })

  it('marks the toolbar as connected when forceConnected is true', () => {
    renderToolbar({ forceConnected: true })

    // connected-sidebar is a behavioral hook: it drives the global
    // :root:has() sidebar width variables.
    expect(screen.getByTestId('side-toolbar')).toHaveClass('connected-sidebar')
  })

  it('shows the shortcuts and bottom panel toggles by default', () => {
    renderToolbar()

    expect(screen.getByTestId('shortcuts-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('bottom-panel-toggle')).toBeInTheDocument()
  })

  it('hides the shortcuts and bottom panel toggles when hideWorkspaceToggles is set', () => {
    renderToolbar({ hideWorkspaceToggles: true })

    expect(screen.queryByTestId('shortcuts-toggle')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bottom-panel-toggle')).not.toBeInTheDocument()
  })

  it('reports telemetry and runs the toggle command when a tab is clicked', async () => {
    const user = userEvent.setup()
    renderToolbar({ visibleTabIds: ['assets'] })

    await user.click(screen.getByRole('button', { name: 'Assets' }))

    expect(spies.trackUiButtonClicked).toHaveBeenCalledWith({
      button_id: 'sidebar_tab_assets_media_selected',
      element_group: 'sidebar'
    })
    expect(spies.toggleAssets).toHaveBeenCalled()
  })

  it('renders the logout icon only on a multi-user server', () => {
    const { unmount } = renderToolbar()
    expect(screen.queryByTestId('logout')).not.toBeInTheDocument()
    unmount()

    state.isMultiUserServer = true
    renderToolbar()
    expect(screen.getByTestId('logout')).toBeInTheDocument()
  })
})
