import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createTestingPinia } from '@pinia/testing'
import { cleanup, render } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import LiteGraphCanvasSplitterOverlay from '@/components/LiteGraphCanvasSplitterOverlay.vue'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackAgentPanelOpened: vi.fn(),
    trackAgentPanelClosed: vi.fn()
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => {
      const values: Record<string, unknown> = {
        'Comfy.Sidebar.Location': 'left',
        'Comfy.Sidebar.UnifiedWidth': false,
        'Comfy.RightSidePanel.IsOpen': false,
        'Comfy.UseNewMenu': 'Top'
      }
      return values[key]
    },
    set: vi.fn()
  })
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    isSelectMode: { value: false },
    isBuilderMode: { value: false }
  })
}))

vi.mock('@/stores/workspaceStore', async () => {
  const { ref } = await import('vue')
  return {
    useWorkspaceStore: () => ({
      focusMode: ref(false)
    })
  }
})

vi.mock('@/stores/workspace/rightSidePanelStore', async () => {
  const { ref } = await import('vue')
  return {
    useRightSidePanelStore: () => ({
      isOpen: ref(false)
    })
  }
})

vi.mock('@/stores/workspace/sidebarTabStore', async () => {
  const { ref } = await import('vue')
  return {
    useSidebarTabStore: () => ({
      activeSidebarTabId: ref(null),
      activeSidebarTab: ref(null)
    })
  }
})

vi.mock('@/stores/workspace/bottomPanelStore', async () => {
  const { ref } = await import('vue')
  return {
    useBottomPanelStore: () => ({
      bottomPanelVisible: ref(false)
    })
  }
})

const Passthrough = defineComponent({
  name: 'Passthrough',
  template: '<div><slot /></div>'
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { sideToolbar: { sidebar: 'Sidebar' } } }
})

afterEach(() => {
  cleanup()
  document.documentElement.style.removeProperty('--workspace-inset-right')
})

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

  it('updates and removes the workspace right inset with the docked agent panel', async () => {
    const { unmount } = render(LiteGraphCanvasSplitterOverlay, {
      global: {
        plugins: [
          createTestingPinia({ createSpy: vi.fn, stubActions: false }),
          i18n
        ],
        stubs: {
          Splitter: Passthrough,
          SplitterPanel: Passthrough
        }
      }
    })

    const agentPanelStore = useAgentPanelStore()
    expect(
      document.documentElement.style.getPropertyValue('--workspace-inset-right')
    ).toBe('0px')

    agentPanelStore.enabled = true
    agentPanelStore.isOpen = true
    agentPanelStore.setWidth(640)
    await nextTick()

    expect(
      document.documentElement.style.getPropertyValue('--workspace-inset-right')
    ).toBe('640px')

    agentPanelStore.close('topbar_button')
    await nextTick()

    expect(
      document.documentElement.style.getPropertyValue('--workspace-inset-right')
    ).toBe('0px')

    unmount()
    expect(
      document.documentElement.style.getPropertyValue('--workspace-inset-right')
    ).toBe('')
  })
})
