import { getActivePinia } from 'pinia'
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'
vi.mock(import('firebase/auth'))

describe('LiteGraphCanvasSplitterOverlay', () => {
  function renderStatefulSidePanels() {
    vi.mocked(useSettingStore().get).mockImplementation((id) => {
      if (id === 'Comfy.Sidebar.Location') return 'left'
      if (id === 'Comfy.RightSidePanel.IsOpen') return true
      return false
    })
    const sidebarTabStore = useSidebarTabStore()
    sidebarTabStore.sidebarTabs = [
      { id: 'probe', title: 'Probe', type: 'custom', render: () => {} }
    ]
    sidebarTabStore.activeSidebarTabId = 'probe'
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: { sideToolbar: { sidebar: 'Sidebar' } } }
    })
    render(LiteGraphCanvasSplitterOverlay, {
      slots: {
        'side-bar-panel': '<input aria-label="Sidebar draft" />',
        'right-side-panel': '<input aria-label="Properties draft" />'
      },
      global: { plugins: [getActivePinia()!, i18n] }
    })
  }

  it('preserves side panel state while focus mode hides the panels', async () => {
    renderStatefulSidePanels()
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Sidebar draft' }),
      'sidebar value'
    )
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Properties draft' }),
      'properties value'
    )

    useWorkspaceStore().focusMode = true
    await nextTick()
    useWorkspaceStore().focusMode = false
    await nextTick()

    expect(screen.getByRole('textbox', { name: 'Sidebar draft' })).toHaveValue(
      'sidebar value'
    )
    expect(
      screen.getByRole('textbox', { name: 'Properties draft' })
    ).toHaveValue('properties value')
  })

  it('preserves side panel state during Agent node selection', async () => {
    renderStatefulSidePanels()
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Sidebar draft' }),
      'sidebar value'
    )
    await fireEvent.update(
      screen.getByRole('textbox', { name: 'Properties draft' }),
      'properties value'
    )

    useAgentNodeSelectionStore().enter()
    await nextTick()
    useAgentNodeSelectionStore().exit()
    await nextTick()

    expect(screen.getByRole('textbox', { name: 'Sidebar draft' })).toHaveValue(
      'sidebar value'
    )
    expect(
      screen.getByRole('textbox', { name: 'Properties draft' })
    ).toHaveValue('properties value')
  })

  it('disables the bottom resize handle while the bottom panel is hidden', async () => {
    useBottomPanelStore().activePanel = null
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: {} }
    })
    render(LiteGraphCanvasSplitterOverlay, { global: { plugins: [i18n] } })
    await nextTick()

    expect(screen.getByRole('separator', { hidden: true })).not.toHaveAttribute(
      'tabindex',
      '0'
    )
  })

  it('persists the final keyboard resize without writing each step', async () => {
    vi.useFakeTimers()
    localStorage.removeItem('bottom-panel-splitter')
    useBottomPanelStore().activePanel = 'shortcuts'
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: {} }
    })
    render(LiteGraphCanvasSplitterOverlay, { global: { plugins: [i18n] } })
    await nextTick()
    await nextTick()
    await vi.advanceTimersByTimeAsync(100)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    screen.getByRole('separator').focus()
    const savedBeforeResize = localStorage.getItem('bottom-panel-splitter')

    await user.keyboard('{ArrowUp>2}')
    expect(localStorage.getItem('bottom-panel-splitter')).toBe(
      savedBeforeResize
    )

    await user.keyboard('{/ArrowUp}')
    expect(localStorage.getItem('bottom-panel-splitter')).toBe('[30,70]')
  })

  it('renders content passed into the agent-panel slot so the docked panel can host in graph mode', () => {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: { sideToolbar: { sidebar: 'Sidebar' } } }
    })

    render(LiteGraphCanvasSplitterOverlay, {
      slots: {
        'agent-panel': '<div data-testid="agent-panel-probe">docked panel</div>'
      },
      global: {
        plugins: [getActivePinia()!, i18n]
      }
    })

    const probe = screen.getByTestId('agent-panel-probe')
    expect(probe.textContent).toBe('docked panel')
  })

  it('keeps tabs with the graph and Agent panel during graph node selection', async () => {
    const pinia = getActivePinia()!
    vi.mocked(useSettingStore().get).mockImplementation((id) => {
      if (id === 'Comfy.Sidebar.Location') return 'left'
      if (id === 'Comfy.UseNewMenu') return 'Top'
      if (id === 'Comfy.RightSidePanel.IsOpen') return true
      return false
    })
    useBottomPanelStore().activePanel = 'shortcuts'

    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: { sideToolbar: { sidebar: 'Sidebar' } } }
    })

    render(LiteGraphCanvasSplitterOverlay, {
      slots: {
        'workflow-tabs': '<div data-testid="workflow-tabs">tabs</div>',
        'side-toolbar': '<div data-testid="side-toolbar">toolbar</div>',
        topmenu: '<div data-testid="topmenu">top menu</div>',
        'right-side-panel': '<div data-testid="right-panel">right</div>',
        'bottom-panel': '<div data-testid="bottom-panel">bottom</div>',
        'graph-canvas-panel': '<div data-testid="graph">graph</div>',
        'agent-panel': '<div data-testid="agent-panel">agent</div>'
      },
      global: {
        plugins: [pinia, i18n]
      }
    })

    expect(screen.getByTestId('workflow-tabs')).toBeInTheDocument()
    expect(screen.getByTestId('side-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('topmenu')).toBeInTheDocument()
    expect(screen.getByTestId('right-panel')).toBeInTheDocument()
    expect(screen.getByTestId('bottom-panel')).toBeInTheDocument()

    useCanvasStore().isPickingNodes = true
    await nextTick()

    expect(screen.getByTestId('workflow-tabs')).toBeInTheDocument()
    expect(screen.getByTestId('side-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('topmenu')).toBeInTheDocument()
    expect(screen.getByTestId('right-panel')).not.toBeVisible()
    expect(screen.getByTestId('bottom-panel')).not.toBeVisible()
    expect(screen.getByTestId('graph')).toBeInTheDocument()
    expect(screen.getByTestId('agent-panel')).toBeInTheDocument()

    useCanvasStore().stopNodePicking()
    await nextTick()

    expect(screen.getByTestId('topmenu')).toBeInTheDocument()
  })
  it('reserves room for the sidebar so the Agent panel stops before it', async () => {
    const agentPanelStore = useAgentPanelStore()
    const sidebarTabStore = useSidebarTabStore()
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: { sideToolbar: { sidebar: 'Sidebar' } } }
    })

    render(LiteGraphCanvasSplitterOverlay, {
      global: {
        plugins: [getActivePinia()!, i18n]
      }
    })

    window.innerWidth = 1200
    window.dispatchEvent(new Event('resize'))
    agentPanelStore.toggleMaximize()
    await nextTick()
    const widthWithoutSidebar = agentPanelStore.width

    sidebarTabStore.sidebarTabs = [
      { id: 'probe', title: 'Probe' } as SidebarTabExtension
    ]
    sidebarTabStore.activeSidebarTabId = 'probe'
    await nextTick()

    expect(agentPanelStore.width).toBeLessThan(widthWithoutSidebar)

    sidebarTabStore.activeSidebarTabId = null
    await nextTick()

    expect(agentPanelStore.width).toBe(widthWithoutSidebar)
  })

  it('preserves bottom panel content when the Agent panel becomes visible', async () => {
    const agentPanelStore = useAgentPanelStore()
    agentPanelStore.enabled = true
    agentPanelStore.isOpen = false
    agentPanelStore.consentAccepted = false

    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: { sideToolbar: { sidebar: 'Sidebar' } } }
    })

    render(LiteGraphCanvasSplitterOverlay, {
      slots: {
        'bottom-panel': '<input aria-label="Extension state" />'
      },
      global: {
        plugins: [i18n]
      }
    })
    await fireEvent.update(
      screen.getByRole('textbox', { hidden: true }),
      'draft'
    )

    agentPanelStore.isOpen = true
    await nextTick()

    expect(screen.getByRole('textbox', { hidden: true })).toHaveValue('draft')
  })
})
