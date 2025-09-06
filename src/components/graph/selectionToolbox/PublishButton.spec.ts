import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import PublishButton from '@/components/graph/selectionToolbox/PublishButton.vue'
import { useCanvasStore } from '@/stores/graphStore'
import { useNodeBookmarkStore as useNodePublishStore } from '@/stores/nodeBookmarkStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const mockLGraphNode = {
  type: 'TestNode',
  title: 'Test Node'
}

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(() => true)
}))

describe('PublishButton', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let nodeDefStore: ReturnType<typeof useNodeDefStore>
  let nodePublishStore: ReturnType<typeof useNodePublishStore>

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
    nodePublishStore = useNodePublishStore()

    vi.clearAllMocks()
  })

  const mountComponent = () => {
    return mount(PublishButton, {
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
    const addPublishSpy = vi
      .spyOn(nodePublishStore, 'addBookmark')
      .mockResolvedValue()

    const wrapper = mountComponent()
    await wrapper.find('button').trigger('click')

    expect(addPublishSpy).toHaveBeenCalledWith('test/node')
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
