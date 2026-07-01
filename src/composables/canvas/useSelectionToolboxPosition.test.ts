import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, markRaw, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSelectionToolboxPosition } from '@/composables/canvas/useSelectionToolboxPosition'
import type { Positionable } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'

const mockApp = vi.hoisted(() => ({
  canvas: null
}))

vi.mock('@/scripts/app', () => ({ app: mockApp }))

vi.mock('@/composables/useVueFeatureFlags', () => ({
  useVueFeatureFlags: () => ({
    shouldRenderVueNodes: { value: false }
  })
}))

describe('useSelectionToolboxPosition', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
  })

  function renderToolboxForSelection(
    items: Iterable<Positionable>,
    state: Partial<LGraphCanvas['state']> = {},
    ds: Partial<LGraphCanvas['ds']> = {}
  ) {
    canvasStore.canvas = markRaw({
      canvas: document.createElement('canvas'),
      ds: {
        offset: ds.offset ?? [0, 0],
        scale: ds.scale ?? 1
      },
      selectedItems: new Set(items),
      state: {
        draggingItems: false,
        selectionChanged: true,
        ...state
      }
    } as Partial<LGraphCanvas> as LGraphCanvas)

    let toolbox: HTMLElement | undefined
    const TestHarness = defineComponent({
      setup() {
        const toolboxRef = ref<HTMLElement>(document.createElement('div'))
        toolbox = toolboxRef.value
        useSelectionToolboxPosition(toolboxRef)
        return () => h('div')
      }
    })

    const wrapper = render(TestHarness)
    if (!toolbox) throw new Error('Toolbox element was not initialized')

    return { toolbox, unmount: wrapper.unmount }
  }

  it('positions groups from their unchanged bounds', () => {
    const group = new LGraphGroup('Group', 1)
    group.pos = [100, 200]
    group.size = [160, 80]

    const { toolbox, unmount } = renderToolboxForSelection([group])

    expect(toolbox.style.getPropertyValue('--tb-y')).toBe('190px')
    unmount()
  })

  it('positions nodes from bounds that include the title bar', () => {
    const node = new LGraphNode('Node')
    node.id = toNodeId(1)
    node.pos = [100, 200]
    node.size = [160, 80]

    const { toolbox, unmount } = renderToolboxForSelection([node])

    expect(toolbox.style.getPropertyValue('--tb-y')).toBe(
      `${190 - LiteGraph.NODE_TITLE_HEIGHT}px`
    )
    unmount()
  })

  it('does not set coordinates when selection is empty', () => {
    const { toolbox, unmount } = renderToolboxForSelection([])

    expect(toolbox.style.getPropertyValue('--tb-x')).toBe('')
    expect(toolbox.style.getPropertyValue('--tb-y')).toBe('')
    unmount()
  })

  it('does not set coordinates while selected items are being dragged', () => {
    const group = new LGraphGroup('Group', 1)
    group.pos = [100, 200]
    group.size = [160, 80]

    const { toolbox, unmount } = renderToolboxForSelection([group], {
      draggingItems: true
    })

    expect(toolbox.style.getPropertyValue('--tb-x')).toBe('')
    expect(toolbox.style.getPropertyValue('--tb-y')).toBe('')
    unmount()
  })

  it('positions multiple selected items from their union bounds', () => {
    const first = new LGraphGroup('First', 1)
    first.pos = [100, 200]
    first.size = [100, 40]
    const second = new LGraphGroup('Second', 2)
    second.pos = [300, 260]
    second.size = [50, 40]

    const { toolbox, unmount } = renderToolboxForSelection([first, second])

    expect(toolbox.style.getPropertyValue('--tb-x')).toBe('270px')
    expect(toolbox.style.getPropertyValue('--tb-y')).toBe('190px')
    unmount()
  })

  it('applies canvas scale and offset to screen coordinates', () => {
    const group = new LGraphGroup('Group', 1)
    group.pos = [100, 200]
    group.size = [100, 40]

    const { toolbox, unmount } = renderToolboxForSelection(
      [group],
      {},
      { offset: [10, 20], scale: 2 }
    )

    expect(toolbox.style.getPropertyValue('--tb-x')).toBe('360px')
    expect(toolbox.style.getPropertyValue('--tb-y')).toBe('420px')
    unmount()
  })
})
