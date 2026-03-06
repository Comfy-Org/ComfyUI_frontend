import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import type { BaseDOMWidget } from '@/scripts/domWidget'
import type { DomWidgetState } from '@/stores/domWidgetStore'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

import DomWidget from './DomWidget.vue'

const mockUpdatePosition = vi.fn()
const mockUpdateClipPath = vi.fn()
const mockCanvasElement = document.createElement('canvas')
const mockCanvasStore = {
  canvas: {
    graph: {
      getNodeById: vi.fn(() => true)
    },
    ds: {
      offset: [0, 0],
      scale: 1
    },
    canvas: mockCanvasElement,
    selected_nodes: {}
  },
  getCanvas: () => ({ canvas: mockCanvasElement }),
  linearMode: false
}

vi.mock('@/composables/element/useAbsolutePosition', () => ({
  useAbsolutePosition: () => ({
    style: reactive<Record<string, string>>({}),
    updatePosition: mockUpdatePosition
  })
}))

vi.mock('@/composables/element/useDomClipping', () => ({
  useDomClipping: () => ({
    style: reactive<Record<string, string>>({}),
    updateClipPath: mockUpdateClipPath
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => mockCanvasStore
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn(() => false)
  })
}))

function createWidgetState(overrideDisabled: boolean): DomWidgetState {
  const domWidgetStore = useDomWidgetStore()
  const node = createMockLGraphNode({
    id: 1,
    constructor: {
      nodeData: {}
    }
  })

  const widget = {
    id: 'dom-widget-id',
    name: 'test_widget',
    type: 'custom',
    value: '',
    options: {},
    node,
    computedDisabled: false
  } as unknown as BaseDOMWidget<object | string>

  domWidgetStore.registerWidget(widget)
  domWidgetStore.setPositionOverride(widget.id, {
    node: createMockLGraphNode({ id: 2 }),
    widget: { computedDisabled: overrideDisabled } as DomWidgetState['widget']
  })

  const state = domWidgetStore.widgetStates.get(widget.id)
  if (!state) throw new Error('Expected registered DomWidgetState')

  state.zIndex = 2
  state.size = [100, 40]

  return reactive(state)
}

describe('DomWidget disabled style', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  afterEach(() => {
    useDomWidgetStore().clear()
    vi.clearAllMocks()
  })

  it('uses disabled style when promoted override widget is computedDisabled', async () => {
    const widgetState = createWidgetState(true)
    const wrapper = mount(DomWidget, {
      props: {
        widgetState
      }
    })

    widgetState.zIndex = 3
    await wrapper.vm.$nextTick()

    const root = wrapper.get('.dom-widget').element as HTMLElement
    expect(root.style.pointerEvents).toBe('none')
    expect(root.style.opacity).toBe('0.5')
  })
})
