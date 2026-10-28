import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@/platform/telemetry'

import { showSettingsPanel } from '@/platform/settings/composables/useSettingsDialog'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { useCommandStore } from '@/stores/commandStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { useUserStore } from '@/stores/userStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

import SideToolbar from './SideToolbar.vue'
vi.mock(import('firebase/auth'))

beforeEach(() => {
  useSettingStore().$patch({
    settingValues: {
      'Comfy.Sidebar.Size': 'normal',
      'Comfy.Sidebar.Location': 'left'
    }
  })
  useCommandStore().registerCommand({
    id: 'Workspace.ToggleSidebarTab.assets',
    function: spies.toggleAssets
  })
})

const spies = vi.hoisted(() => ({
  toggleAssets: vi.fn()
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: false,
  isDesktop: false,
  isNightly: false
}))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

vi.mock(import('@/scripts/api'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { agentBadge: 'AI', agentCreated: 'Agent-created' } } }
})

type SideToolbarProps = ComponentProps<typeof SideToolbar>

function renderToolbar(props: SideToolbarProps = {}) {
  return render(SideToolbar, {
    props,
    global: {
      plugins: [i18n],
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

const assetsTab: SidebarTabExtension = {
  type: 'custom',
  render: () => {},
  id: 'assets',
  icon: 'pi pi-image',
  tooltip: 'Assets',
  label: 'Assets',
  title: 'Assets'
}

const workflowsTab: SidebarTabExtension = {
  type: 'custom',
  render: () => {},
  id: 'workflows',
  icon: 'pi pi-folder',
  tooltip: 'Workflows',
  label: 'Workflows',
  title: 'Workflows'
}

describe('SideToolbar', () => {
  beforeEach(() => {
    Object.assign(useUserStore(), { isMultiUserServer: false })
    useSidebarTabStore().sidebarTabs = [assetsTab, workflowsTab]
    useSidebarTabStore().activeSidebarTabId = null
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

    expect(useTelemetry()?.trackUiButtonClicked).toHaveBeenCalledWith({
      button_id: 'sidebar_tab_assets_media_selected',
      element_group: 'sidebar'
    })
    expect(spies.toggleAssets).toHaveBeenCalled()
  })

  it('renders the logout icon only on a multi-user server', () => {
    const { unmount } = renderToolbar()
    expect(screen.queryByTestId('logout')).not.toBeInTheDocument()
    unmount()

    Object.assign(useUserStore(), { isMultiUserServer: true })
    renderToolbar()
    expect(screen.getByTestId('logout')).toBeInTheDocument()
  })

  it('badges sourced agent tabs and disables the one that was right-clicked', async () => {
    const user = userEvent.setup()
    const extensionStore = useExtensionStore()
    extensionStore.registerExtension({
      name: 'agent.cushions.toolbar',
      provenance: { createdBy: 'comfy-agent' }
    })
    extensionStore.registerExtension({
      name: 'agent.lights.toolbar',
      provenance: { createdBy: 'comfy-agent' }
    })
    useSettingStore().$patch({
      settingValues: {
        'Comfy.Extension.Disabled': [],
        'Comfy.Extension.DisabledPacks': []
      }
    })
    useSidebarTabStore().sidebarTabs = [
      {
        ...assetsTab,
        source: { extensionName: 'agent.cushions.toolbar' }
      },
      {
        ...workflowsTab,
        source: { extensionName: 'agent.lights.toolbar' }
      }
    ]
    vi.mocked(api.storeSettings).mockResolvedValue(new Response())
    const reload = vi.spyOn(window.location, 'reload').mockReturnValue()
    renderToolbar()

    expect(screen.getAllByText('AI')).toHaveLength(2)

    await fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Workflows (Agent-created)' })
    )
    await user.click(await screen.findByRole('menuitem', { name: /disable/i }))

    await vi.waitFor(() =>
      expect(api.storeSettings).toHaveBeenCalledExactlyOnceWith({
        'Comfy.Extension.Disabled': ['agent.lights.toolbar'],
        'Comfy.Extension.DisabledPacks': []
      })
    )
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  it('keeps an agent tab badged and named when the tab carries its own iconBadge', () => {
    useExtensionStore().registerExtension({
      name: 'agent.cushions.toolbar',
      provenance: { createdBy: 'comfy-agent' }
    })
    useSidebarTabStore().sidebarTabs = [
      {
        ...assetsTab,
        iconBadge: () => '7',
        source: { extensionName: 'agent.cushions.toolbar' }
      }
    ]
    renderToolbar()

    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Assets (Agent-created)' })
    ).toBeInTheDocument()
  })

  it('leaves a non-agent tab unbadged and unnamed by provenance', () => {
    useSidebarTabStore().sidebarTabs = [{ ...assetsTab, iconBadge: () => '7' }]
    renderToolbar()

    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.queryByText('AI')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Assets' })).toBeInTheDocument()
  })

  it('navigates Settings to the Agent-created extensions from the tab menu', async () => {
    const user = userEvent.setup()
    useExtensionStore().registerExtension({
      name: 'agent.cushions.toolbar',
      provenance: { createdBy: 'comfy-agent' }
    })
    useSidebarTabStore().sidebarTabs = [
      { ...assetsTab, source: { extensionName: 'agent.cushions.toolbar' } }
    ]
    renderToolbar()

    await fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Assets (Agent-created)' })
    )
    await user.click(await screen.findByRole('menuitem', { name: /manage/i }))

    expect(showSettingsPanel).toHaveBeenCalledExactlyOnceWith('extension', {
      extensionFilter: 'agentCreated'
    })
  })

  it('preserves the native context menu for tabs without an agent extension', () => {
    renderToolbar()
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    })

    screen.getByRole('button', { name: 'Assets' }).dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })
})
