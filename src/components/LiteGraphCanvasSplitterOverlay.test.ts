import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { readFileSync } from 'fs'
import { setActivePinia } from 'pinia'
import { resolve } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({ currentUser: null, loading: false }))
}))

/**
 * Regression test: the graph-canvas-panel SplitterPanel must not clip
 * absolutely-positioned children (like GraphCanvasMenu).
 *
 * PrimeVue applies `overflow: hidden` to all SplitterPanels by default.
 * Without an explicit `overflow-visible` override, the bottom-right canvas
 * toolbar becomes invisible on mobile viewports where the panel's bounding
 * box is smaller than the full canvas area.
 *
 * @see https://www.notion.so/Bug-Graph-canvas-toolbar-not-visible-on-mobile-3246d73d36508144ae00f10065c42fac
 */
describe('LiteGraphCanvasSplitterOverlay', () => {
  it('graph-canvas-panel has overflow-visible to prevent clipping toolbar on mobile', () => {
    const filePath = resolve(__dirname, 'LiteGraphCanvasSplitterOverlay.vue')
    const source = readFileSync(filePath, 'utf-8')

    // The SplitterPanel wrapping graph-canvas-panel must include overflow-visible
    // to override PrimeVue's default overflow:hidden on .p-splitterpanel.
    // Without this, GraphCanvasMenu (absolute right-0 bottom-0) gets clipped on mobile.
    expect(source).toMatch(
      /class="[^"]*graph-canvas-panel[^"]*overflow-visible/
    )
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
        plugins: [createTestingPinia({ createSpy: vi.fn }), i18n],
        stubs: { Splitter: true, SplitterPanel: true }
      }
    })

    const probe = screen.getByTestId('agent-panel-probe')
    expect(probe.textContent).toBe('docked panel')
  })

  it('keeps tabs with the graph and Agent panel during graph node selection', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)
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
        plugins: [pinia, i18n],
        stubs: {
          Splitter: { template: '<div><slot /></div>' },
          SplitterPanel: { template: '<div><slot /></div>' }
        }
      }
    })

    expect(screen.getByTestId('workflow-tabs')).toBeInTheDocument()
    expect(screen.getByTestId('side-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('topmenu')).toBeInTheDocument()
    expect(screen.getByTestId('right-panel')).toBeInTheDocument()
    expect(screen.getByTestId('bottom-panel')).toBeInTheDocument()

    useAgentNodeSelectionStore().enter()
    await nextTick()

    expect(screen.getByTestId('workflow-tabs')).toBeInTheDocument()
    expect(screen.getByTestId('side-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('topmenu')).toBeInTheDocument()
    expect(screen.queryByTestId('right-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('bottom-panel')).not.toBeVisible()
    expect(screen.getByTestId('graph')).toBeInTheDocument()
    expect(screen.getByTestId('agent-panel')).toBeInTheDocument()

    useAgentNodeSelectionStore().exit()
    await nextTick()

    expect(screen.getByTestId('topmenu')).toBeInTheDocument()
  })
  it('refreshes the splitter only when the Agent panel becomes visible', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    setActivePinia(pinia)
    const agentPanelStore = useAgentPanelStore()
    agentPanelStore.enabled = true
    agentPanelStore.isOpen = true
    agentPanelStore.consentAccepted = false

    const splitterMounts = vi.fn()
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: { sideToolbar: { sidebar: 'Sidebar' } } }
    })

    render(LiteGraphCanvasSplitterOverlay, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          Splitter: {
            setup: splitterMounts,
            template: '<div><slot /></div>'
          },
          SplitterPanel: { template: '<div><slot /></div>' }
        }
      }
    })
    const mountsBeforeConsent = splitterMounts.mock.calls.length

    agentPanelStore.consentAccepted = true
    await nextTick()

    expect(splitterMounts.mock.calls.length).toBeGreaterThan(
      mountsBeforeConsent
    )
  })
})
