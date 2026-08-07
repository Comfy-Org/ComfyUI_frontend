import { render } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

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
  it('cancels a queued fallback when unmounted', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: { rightSidePanel: { activeTab: 'info' } }
    })
    const { unmount } = render(RightSidePanel, {
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

    unmount()
    await Promise.resolve()

    expect(rightSidePanelStore.openPanel).not.toHaveBeenCalled()
  })
})
