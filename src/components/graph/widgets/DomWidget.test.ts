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

const mockUpdateClipPath = vi.fn()
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
    selectNode: vi.fn(),
    bringToFront: vi.fn(),
    selectedItems: new Set()
  },
  getCanvas: () => ({
    canvas: mockCanvasElement,
    ds: mockCanvasStore.canvas.ds
  }),
  linearMode: false
}

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

function createWidgetState(
  disabled: boolean,
  id = 'dom-widget-id'
): DomWidgetState {
  const domWidgetStore = useDomWidgetStore()
  const node = createMockLGraphNode({
    id: 1,
    constructor: {
      nodeData: {}
    }
  })

  const widget = fromPartial<BaseDOMWidget>({
    id,
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
    mockClippingStyle.value = {}
    mockCanvasStore.canvas.selected_nodes = {}
    mockCanvasStore.canvas.selectedItems = new Set()
  })

  it('positions a newly mounted widget', () => {
    const widgetState = createWidgetState(false)
    const { container } = render(DomWidget, {
      props: {
        widgetState
      }
    })

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const root = container.querySelector('.dom-widget') as HTMLElement
    expect(root.style.left).toBe('0px')
    expect(root.style.top).toBe('0px')
    expect(root.style.width).toBe('100px')
    expect(root.style.height).toBe('40px')
    expect(root.style.transform).toBe('scale(1)')
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

describe('DomWidget position update matrix', () => {
  const widgetCounts = [0, 10, 100] as const

  afterEach(() => {
    useDomWidgetStore().clear()
  })

  it.for(widgetCounts)(
    'keeps stable styles and writes changed positions for %i widgets',
    async (count) => {
      const states = Array.from({ length: count }, (_, index) =>
        createWidgetState(false, `position-widget-${index}`)
      )
      const rendered = states.map((widgetState) =>
        render(DomWidget, { props: { widgetState } })
      )
      const roots = rendered.map(({ container }) => {
        // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
        return container.querySelector('.dom-widget') as HTMLElement
      })
      const initialStyles = roots.map((root) => root.getAttribute('style'))

      await nextTick()
      expect(roots.map((root) => root.getAttribute('style'))).toEqual(
        initialStyles
      )

      for (const state of states) {
        state.pos = [state.pos[0] + 1, state.pos[1]]
      }
      await nextTick()
      expect(roots.map((root) => root.style.left)).toEqual(
        Array.from({ length: count }, () => '1px')
      )

      for (const result of rendered) result.unmount()
    }
  )
})

describe('native DOM widget interaction lifecycle', () => {
  afterEach(() => {
    useDomWidgetStore().clear()
  })

  it('preserves selection and outside-click focus behavior, then removes listeners', async () => {
    const widgetState = createWidgetState(false)
    const input = document.createElement('input')
    const blur = vi.spyOn(input, 'blur')
    Object.assign(widgetState.widget, { element: input })

    const rendered = render(DomWidget, {
      props: {
        widgetState
      }
    })
    await nextTick()
    await nextTick()

    input.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(mockCanvasStore.canvas.selectNode).toHaveBeenCalledWith(
      widgetState.widget.node
    )
    expect(mockCanvasStore.canvas.bringToFront).toHaveBeenCalledWith(
      widgetState.widget.node
    )

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(blur).toHaveBeenCalledOnce()

    rendered.unmount()
    vi.mocked(mockCanvasStore.canvas.selectNode).mockClear()
    blur.mockClear()

    input.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(mockCanvasStore.canvas.selectNode).not.toHaveBeenCalled()
    expect(blur).not.toHaveBeenCalled()
  })

  it('removes hit testing in read-only mode', async () => {
    const widgetState = createWidgetState(false)
    widgetState.readonly = true
    const { container } = render(DomWidget, {
      props: {
        widgetState
      }
    })
    await nextTick()

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const root = container.querySelector('.dom-widget') as HTMLElement
    expect(root.style.pointerEvents).toBe('none')
  })
})
