import { render } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'

import RightSidePanel from './RightSidePanel.vue'

vi.mock('@/composables/graph/useGraphHierarchy', () => ({
  useGraphHierarchy: () => ({ findParentGroup: vi.fn() })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

describe('RightSidePanel', () => {
  it('keeps a tab that becomes available before its queued fallback', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: { rightSidePanel: { activeTab: 'info' } }
    })
    render(RightSidePanel, {
      global: {
        plugins: [pinia, i18n],
        stubs: {
          EditableText: true,
          Tab: true,
          TabList: true,
          Button: true
        }
      }
    })
    const rightSidePanelStore = useRightSidePanelStore()
    const canvasStore = useCanvasStore()

    canvasStore.selectedItems = [new LGraphNode('selected')]
    await Promise.resolve()

    expect(rightSidePanelStore.activeTab).toBe('info')
    expect(rightSidePanelStore.openPanel).not.toHaveBeenCalled()
  })
})
