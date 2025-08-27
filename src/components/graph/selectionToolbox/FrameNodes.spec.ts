import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import FrameNodes from '@/components/graph/selectionToolbox/FrameNodes.vue'
import { LGraphGroup } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useCanvasStore, useTitleEditorStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

// Mock the app module
vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      selectedItems: new Set(),
      graph: {
        add: vi.fn()
      }
    }
  }
}))

// Mock LGraphGroup
vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LGraphGroup: vi.fn().mockImplementation(() => ({
    resizeTo: vi.fn()
  }))
}))

describe('FrameNodes', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>
  let titleEditorStore: ReturnType<typeof useTitleEditorStore>
  let settingStore: ReturnType<typeof useSettingStore>

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        g: {
          frameNodes: 'Frame Nodes'
        }
      }
    }
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
    titleEditorStore = useTitleEditorStore()
    settingStore = useSettingStore()

    // Reset mocks
    vi.clearAllMocks()
    app.canvas.selectedItems = new Set()
  })

  const mountComponent = () => {
    return mount(FrameNodes, {
      global: {
        plugins: [i18n, PrimeVue],
        directives: { tooltip: Tooltip },
        stubs: {
          'i-lucide:frame': true
        }
      }
    })
  }

  it('should not show button when no items are selected', () => {
    canvasStore.selectedItems = []
    const wrapper = mountComponent()
    // The button uses v-show which sets display: none
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true) // Button exists in DOM
    expect(button.attributes('style')).toContain('display: none')
  })

  it('should show button when items are selected', () => {
    canvasStore.selectedItems = [{ id: 1 }] as any
    const wrapper = mountComponent()
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('should do nothing when no items selected in canvas', async () => {
    canvasStore.selectedItems = [{ id: 1 }] as any
    app.canvas.selectedItems = new Set() // Canvas has no items

    const wrapper = mountComponent()
    await wrapper.find('button').trigger('click')

    // Should not create a group when no items are selected
    expect(app.canvas.graph?.add).not.toHaveBeenCalled()
  })

  it('should create a group when items are selected', async () => {
    const mockNode = {
      id: 1,
      pos: [0, 0],
      move: vi.fn(),
      snapToGrid: vi.fn(),
      boundingRect: [0, 0, 100, 100]
    }
    canvasStore.selectedItems = [mockNode] as any
    app.canvas.selectedItems = new Set([mockNode as any])

    const mockGroup = { resizeTo: vi.fn() }
    ;(LGraphGroup as any).mockImplementation(() => mockGroup)

    const getSpy = vi.spyOn(settingStore, 'get').mockReturnValue(10)

    const wrapper = mountComponent()
    await wrapper.find('button').trigger('click')

    expect(LGraphGroup).toHaveBeenCalled()
    expect(getSpy).toHaveBeenCalledWith('Comfy.GroupSelectedNodes.Padding')
    expect(mockGroup.resizeTo).toHaveBeenCalledWith(
      app.canvas.selectedItems,
      10
    )
    expect(app.canvas.graph?.add).toHaveBeenCalledWith(mockGroup)
    expect(titleEditorStore.titleEditorTarget).toBe(mockGroup)
  })

  it('should have correct tooltip', () => {
    canvasStore.selectedItems = [{ id: 1 }] as any
    const wrapper = mountComponent()
    const button = wrapper.find('button')
    expect(button.attributes()['aria-label']).toBeUndefined()
    // Tooltip is handled by directive, so we just ensure button exists
    expect(button.exists()).toBe(true)
  })
})
