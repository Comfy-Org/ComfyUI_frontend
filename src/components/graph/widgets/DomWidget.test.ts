import { render } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { BaseDOMWidget } from '@/scripts/domWidget'
import type { DomWidgetState } from '@/stores/domWidgetStore'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import DomWidget from './DomWidget.vue'

const mockUpdatePosition = vi.fn()
const mockUpdateClipPath = vi.fn()
const mockPositionStyle = ref<Record<string, string>>({})
const mockClippingStyle = ref<Record<string, string>>({})
const mockDomClippingEnabled = ref(false)
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
    selected_nodes: {},
    selectedItems: new Set()
  },
  getCanvas: () => ({ canvas: mockCanvasElement }),
  linearMode: false
}

vi.mock('@/composables/element/useAbsolutePosition', () => ({
  useAbsolutePosition: () => ({
    style: mockPositionStyle,
    updatePosition: mockUpdatePosition
  })
}))

vi.mock('@/composables/element/useDomClipping', () => ({
  useDomClipping: () => ({
    style: mockClippingStyle,
    updateClipPath: mockUpdateClipPath
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => mockCanvasStore
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn((key: string) =>
      key === 'Comfy.DOMClippingEnabled' ? mockDomClippingEnabled.value : false
    )
  })
}))

function createWidgetState(disabled: boolean): DomWidgetState {
  const domWidgetStore = useDomWidgetStore()
  const node = createMockLGraphNode({
    id: 1,
    constructor: {
      nodeData: {}
    }
  })

  const widget = fromPartial<BaseDOMWidget<object | string>>({
    id: 'dom-widget-id',
    name: 'test_widget',
    type: 'custom',
    value: '',
    options: {},
    node,
    computedDisabled: disabled
  })

  domWidgetStore.registerWidget(widget)

  const state = domWidgetStore.widgetStates.get(widget.id)
  if (!state) throw new Error('Expected registered DomWidgetState')

  state.zIndex = 2
  state.size = [100, 40]

  return reactive(state)
}

describe('DomWidget style', () => {
  afterEach(() => {
    useDomWidgetStore().clear()
    mockDomClippingEnabled.value = false
    mockPositionStyle.value = {}
    mockClippingStyle.value = {}
    mockCanvasStore.canvas.selected_nodes = {}
    mockCanvasStore.canvas.selectedItems = new Set()
  })

  it('positions a newly mounted widget', () => {
    const widgetState = createWidgetState(false)
    render(DomWidget, {
      props: {
        widgetState
      }
    })

    expect(mockUpdatePosition).toHaveBeenCalledWith(widgetState)
  })

  it('uses disabled style when widget is computedDisabled', async () => {
    const widgetState = createWidgetState(true)
    const { container } = render(DomWidget, {
      props: {
        widgetState
      }
    })

    widgetState.zIndex = 3
    await nextTick()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const root = container.querySelector('.dom-widget') as HTMLElement
    expect(root.style.pointerEvents).toBe('none')
    expect(root.style.opacity).toBe('0.5')
  })

  it('applies clipping style when DOM clipping is enabled', async () => {
    mockDomClippingEnabled.value = true
    const widgetState = createWidgetState(false)
    const { container } = render(DomWidget, {
      props: {
        widgetState
      }
    })

    mockClippingStyle.value = { clipPath: 'inset(1px)' }
    await nextTick()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const root = container.querySelector('.dom-widget') as HTMLElement
    expect(root.style.clipPath).toBe('inset(1px)')
  })

  it('updates clipping when DOM clipping is enabled', async () => {
    const widgetState = createWidgetState(false)
    render(DomWidget, {
      props: {
        widgetState
      }
    })
    mockUpdateClipPath.mockClear()

    mockDomClippingEnabled.value = true
    await nextTick()

    expect(mockUpdateClipPath).toHaveBeenCalled()
  })

  it('clips against selectedItems order when legacy selection order differs', async () => {
    const widgetState = createWidgetState(false)
    const firstSelected = new LGraphNode('first selected')
    firstSelected.pos = [10, 20]
    firstSelected.size = [30, 40]
    firstSelected.updateArea()
    const legacyFirst = new LGraphNode('legacy first')
    legacyFirst.pos = [50, 60]
    legacyFirst.size = [70, 80]
    legacyFirst.updateArea()
    mockCanvasStore.canvas.selectedItems = new Set([firstSelected, legacyFirst])
    mockCanvasStore.canvas.selected_nodes = {
      1: legacyFirst,
      2: firstSelected
    }

    render(DomWidget, {
      props: {
        widgetState
      }
    })
    mockDomClippingEnabled.value = true
    await nextTick()

    expect(mockUpdateClipPath).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      mockCanvasElement,
      false,
      {
        x: firstSelected.renderArea[0],
        y: firstSelected.renderArea[1],
        width: firstSelected.renderArea[2],
        height: firstSelected.renderArea[3],
        scale: 1,
        offset: [0, 0]
      }
    )
  })

  it('ignores clipping style when DOM clipping is disabled', async () => {
    const widgetState = createWidgetState(false)
    const { container } = render(DomWidget, {
      props: {
        widgetState
      }
    })

    mockClippingStyle.value = { clipPath: 'inset(1px)' }
    await nextTick()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const root = container.querySelector('.dom-widget') as HTMLElement
    expect(root.style.clipPath).toBe('')
  })

  it('disables pointer events when widget is not visible', async () => {
    const widgetState = createWidgetState(false)
    widgetState.visible = false
    const { container } = render(DomWidget, {
      props: {
        widgetState
      }
    })

    widgetState.zIndex = 3
    await nextTick()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const root = container.querySelector('.dom-widget') as HTMLElement
    expect(root.style.pointerEvents).toBe('none')
  })
})
