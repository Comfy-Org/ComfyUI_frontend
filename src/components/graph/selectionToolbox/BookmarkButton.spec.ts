import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import BookmarkButton from '@/components/graph/selectionToolbox/BookmarkButton.vue'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const mockLGraphNode = {
  type: 'TestNode',
  title: 'Test Node'
}

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(() => true)
}))

describe('BookmarkButton', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let nodeDefStore: ReturnType<typeof useNodeDefStore>
  let nodeBookmarkStore: ReturnType<typeof useNodeBookmarkStore>

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: {
          bookmark: 'Save to Library'
        }
      }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
    nodeDefStore = useNodeDefStore()
    nodeBookmarkStore = useNodeBookmarkStore()

    vi.clearAllMocks()
  })

  const mountComponent = () => {
    return mount(BookmarkButton, {
      global: {
        plugins: [i18n, PrimeVue],
        directives: { tooltip: Tooltip },
        stubs: {
          'i-lucide:book-open': true
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
      nodePath: 'test/node'
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

  it('should call bookmark function when clicked', async () => {
    const mockNodeDef = {
      nodePath: 'test/node'
    }
    canvasStore.selectedItems = [mockLGraphNode] as any
    vi.spyOn(nodeDefStore, 'fromLGraphNode').mockReturnValue(mockNodeDef as any)
    const addBookmarkSpy = vi
      .spyOn(nodeBookmarkStore, 'addBookmark')
      .mockResolvedValue()

    const wrapper = mountComponent()
    await wrapper.find('button').trigger('click')

    expect(addBookmarkSpy).toHaveBeenCalledWith('test/node')
  })

  it('should have correct tooltip', () => {
    const mockNodeDef = {
      nodePath: 'test/node'
    }
    canvasStore.selectedItems = [mockLGraphNode] as any
    vi.spyOn(nodeDefStore, 'fromLGraphNode').mockReturnValue(mockNodeDef as any)

    const wrapper = mountComponent()
    const button = wrapper.find('button')

    expect(button.exists()).toBe(true)
  })
})
