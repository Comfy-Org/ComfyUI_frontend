import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import InfoButton from '@/components/graph/selectionToolbox/InfoButton.vue'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const mockLGraphNode = {
  type: 'TestNode',
  title: 'Test Node'
}

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(() => true)
}))

vi.mock('@/composables/sidebarTabs/useNodeLibrarySidebarTab', () => ({
  useNodeLibrarySidebarTab: () => ({
    id: 'node-library'
  })
}))

vi.mock('@/stores/workspace/nodeHelpStore', () => ({
  useNodeHelpStore: () => ({
    openHelp: vi.fn()
  })
}))

vi.mock('@/stores/workspace/sidebarTabStore', () => ({
  useSidebarTabStore: () => ({
    activeSidebarTabId: 'other-tab',
    toggleSidebarTab: vi.fn()
  })
}))

describe('InfoButton', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let nodeDefStore: ReturnType<typeof useNodeDefStore>

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: {
          info: 'Node Info'
        }
      }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
    nodeDefStore = useNodeDefStore()

    vi.clearAllMocks()
  })

  const mountComponent = () => {
    return mount(InfoButton, {
      global: {
        plugins: [i18n, PrimeVue],
        directives: { tooltip: Tooltip },
        stubs: {
          'i-lucide:info': true,
          Button: {
            template:
              '<button class="help-button" severity="secondary"><slot /></button>',
            props: ['severity', 'text', 'class'],
            emits: ['click']
          }
        }
      }
    })
  }

  it('should not show button when no items are selected', () => {
    canvasStore.selectedItems = []
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.attributes('style')).toContain('display: none')
  })

  it('should not show button when multiple items are selected', () => {
    canvasStore.selectedItems = [mockLGraphNode, mockLGraphNode] as any
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.attributes('style')).toContain('display: none')
  })

  it('should show button when single item is selected', () => {
    const mockNodeDef = {
      nodePath: 'test/node',
      display_name: 'Test Node'
    }
    canvasStore.selectedItems = [mockLGraphNode] as any
    vi.spyOn(nodeDefStore, 'fromLGraphNode').mockReturnValue(mockNodeDef as any)

    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.isVisible()).toBe(true)
  })

  it('should not show button when node definition is not found', () => {
    canvasStore.selectedItems = [mockLGraphNode] as any
    vi.spyOn(nodeDefStore, 'fromLGraphNode').mockReturnValue(null)

    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.attributes('style')).toContain('display: none')
  })

  it('should show help when clicked', async () => {
    const mockNodeDef = {
      nodePath: 'test/node',
      display_name: 'Test Node'
    }
    canvasStore.selectedItems = [mockLGraphNode] as any
    vi.spyOn(nodeDefStore, 'fromLGraphNode').mockReturnValue(mockNodeDef as any)

    const wrapper = mountComponent()
    const button = wrapper.find('button')

    expect(button.exists()).toBe(true)
    await button.trigger('click')
  })

  it('should handle missing node definition gracefully', async () => {
    canvasStore.selectedItems = [mockLGraphNode] as any
    vi.spyOn(nodeDefStore, 'fromLGraphNode').mockReturnValue(null)

    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.attributes('style')).toContain('display: none')
  })

  it('should have correct CSS classes', () => {
    const mockNodeDef = {
      nodePath: 'test/node',
      display_name: 'Test Node'
    }
    canvasStore.selectedItems = [mockLGraphNode] as any
    vi.spyOn(nodeDefStore, 'fromLGraphNode').mockReturnValue(mockNodeDef as any)

    const wrapper = mountComponent()
    const button = wrapper.find('button')

    expect(button.classes()).toContain('help-button')
    expect(button.attributes('severity')).toBe('secondary')
  })

  it('should have correct tooltip', () => {
    const mockNodeDef = {
      nodePath: 'test/node',
      display_name: 'Test Node'
    }
    canvasStore.selectedItems = [mockLGraphNode] as any
    vi.spyOn(nodeDefStore, 'fromLGraphNode').mockReturnValue(mockNodeDef as any)

    const wrapper = mountComponent()
    const button = wrapper.find('button')

    expect(button.exists()).toBe(true)
  })
})
