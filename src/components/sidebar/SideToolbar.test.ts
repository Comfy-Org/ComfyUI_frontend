import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@comfyorg/telemetry'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useCommandStore } from '@/platform/keybindings/commandStore'
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

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))

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
      plugins: [i18n],
      stubs: {
        ComfyMenuButton: { template: '<div />' },
        SidebarTemplatesButton: { template: '<div />' },
        SidebarLogoutIcon: { template: '<div data-testid="logout" />' },
        SidebarHelpCenterIcon: { template: '<div />' },
        SidebarSettingsButton: { template: '<div />' },
        CurrentUserButton: {
          props: ['side'],
          template:
            '<div data-testid="current-user-button" :data-side="side" />'
        },
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

  describe('profile button', () => {
    beforeEach(() => {
      useCurrentUser().isLoggedIn = computed(() => true)
    })

    it('stays out of the sidebar while billing_new_ux_enabled is off', () => {
      vi.mocked(useFeatureFlags().flags).billingNewUxEnabled = false
      renderToolbar()

      expect(
        screen.queryByTestId('current-user-button')
      ).not.toBeInTheDocument()
    })

    it('mounts at the bottom of the sidebar while billing_new_ux_enabled is on', () => {
      vi.mocked(useFeatureFlags().flags).billingNewUxEnabled = true
      renderToolbar()

      expect(screen.getByTestId('current-user-button')).toBeInTheDocument()
    })

    it('stays out of the sidebar when signed out', () => {
      vi.mocked(useFeatureFlags().flags).billingNewUxEnabled = true
      useCurrentUser().isLoggedIn = computed(() => false)
      renderToolbar()

      expect(
        screen.queryByTestId('current-user-button')
      ).not.toBeInTheDocument()
    })

    it.for([
      { location: 'left', side: 'right' },
      { location: 'right', side: 'left' }
    ] as const)(
      'opens the menu toward the canvas when the sidebar is on the $location',
      ({ location, side }) => {
        vi.mocked(useFeatureFlags().flags).billingNewUxEnabled = true
        useSettingStore().settingValues['Comfy.Sidebar.Location'] = location
        renderToolbar()

        expect(screen.getByTestId('current-user-button')).toHaveAttribute(
          'data-side',
          side
        )
      }
    )
  })
})
