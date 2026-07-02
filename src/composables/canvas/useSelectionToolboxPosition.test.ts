import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, markRaw, nextTick, ref } from 'vue'
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
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { toNodeId } from '@/types/nodeId'
import { createMockPositionable } from '@/utils/__tests__/litegraphTestUtils'

const mockApp = vi.hoisted(() => ({
  canvas: null
}))

const mockFeatureFlags = vi.hoisted(() => ({
  refs: null as null | {
    shouldRenderVueNodes: { value: boolean }
  }
}))

vi.mock('@/scripts/app', () => ({ app: mockApp }))

vi.mock('@/composables/useVueFeatureFlags', async () => {
  const { ref } = await import('vue')
  const shouldRenderVueNodes = ref(false)
  mockFeatureFlags.refs = {
    shouldRenderVueNodes
  }

  return {
    useVueFeatureFlags: () => ({
      shouldRenderVueNodes
    })
  }
})

describe('useSelectionToolboxPosition', () => {
  let canvasStore: ReturnType<typeof useCanvasStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore = useCanvasStore()
    layoutStore.initializeFromLiteGraph([])
    layoutStore.isDraggingVueNodes.value = false
    if (mockFeatureFlags.refs) {
      mockFeatureFlags.refs.shouldRenderVueNodes.value = false
    }
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
    let visible!: ReturnType<typeof useSelectionToolboxPosition>['visible']
    const TestHarness = defineComponent({
      setup() {
        const toolboxRef = ref<HTMLElement>(document.createElement('div'))
        toolbox = toolboxRef.value
        ;({ visible } = useSelectionToolboxPosition(toolboxRef))
        return () => h('div')
      }
    })

    const wrapper = render(TestHarness)
    if (!toolbox) throw new Error('Toolbox element was not initialized')

    if (!visible) throw new Error('Visible state was not initialized')

    return { toolbox, unmount: wrapper.unmount, visible }
  }

  function setCanvasSelection(
    items: Iterable<Positionable>,
    state: Partial<LGraphCanvas['state']> = {}
  ) {
    canvasStore.canvas = markRaw({
      canvas: document.createElement('canvas'),
      ds: {
        offset: [0, 0],
        scale: 1
      },
      selectedItems: new Set(items),
      state: {
        draggingItems: false,
        selectionChanged: true,
        ...state
      }
    } as Partial<LGraphCanvas> as LGraphCanvas)
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

  it('does not update when selection state is unchanged', () => {
    const group = new LGraphGroup('Group', 1)
    group.pos = [100, 200]
    group.size = [160, 80]

    const { toolbox, visible, unmount } = renderToolboxForSelection([group], {
      selectionChanged: false
    })

    expect(visible.value).toBe(false)
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

  it('uses Vue layout bounds when Vue node rendering is enabled', () => {
    if (!mockFeatureFlags.refs) {
      throw new Error('feature flag refs were not initialized')
    }
    mockFeatureFlags.refs.shouldRenderVueNodes.value = true
    const node = new LGraphNode('Node')
    node.id = toNodeId(12)
    node.pos = [100, 200]
    node.size = [160, 80]
    layoutStore.initializeFromLiteGraph([
      {
        id: node.id,
        pos: [300, 400],
        size: [200, 120]
      }
    ])

    const { toolbox, unmount } = renderToolboxForSelection([node])

    expect(toolbox.style.getPropertyValue('--tb-x')).toBe('400px')
    expect(toolbox.style.getPropertyValue('--tb-y')).toBe(
      `${390 - LiteGraph.NODE_TITLE_HEIGHT}px`
    )
    unmount()
  })

  it('falls back to LiteGraph node bounds when Vue layout is missing', () => {
    if (!mockFeatureFlags.refs) {
      throw new Error('feature flag refs were not initialized')
    }
    mockFeatureFlags.refs.shouldRenderVueNodes.value = true
    const node = new LGraphNode('Node')
    node.id = toNodeId(13)
    node.pos = [100, 200]
    node.size = [160, 80]

    const { toolbox, unmount } = renderToolboxForSelection([node])

    expect(toolbox.style.getPropertyValue('--tb-y')).toBe(
      `${190 - LiteGraph.NODE_TITLE_HEIGHT}px`
    )
    unmount()
  })

  it('hides the toolbox while Vue nodes are being dragged', () => {
    if (!mockFeatureFlags.refs) {
      throw new Error('feature flag refs were not initialized')
    }
    mockFeatureFlags.refs.shouldRenderVueNodes.value = true
    layoutStore.isDraggingVueNodes.value = true
    const group = new LGraphGroup('Group', 1)
    group.pos = [100, 200]
    group.size = [160, 80]

    const { toolbox, unmount } = renderToolboxForSelection([group])

    expect(toolbox.style.getPropertyValue('--tb-x')).toBe('')
    expect(toolbox.style.getPropertyValue('--tb-y')).toBe('')
    unmount()
  })

  it('ignores selected items that are not nodes or groups', () => {
    const item = createMockPositionable({
      id: toNodeId(52),
      pos: [100, 200],
      size: [160, 80],
      boundingRect: [100, 200, 160, 80]
    })

    const { toolbox, visible, unmount } = renderToolboxForSelection([item])

    expect(visible.value).toBe(true)
    expect(toolbox.style.getPropertyValue('--tb-x')).toBe('')
    expect(toolbox.style.getPropertyValue('--tb-y')).toBe('')
    unmount()
  })

  it('ignores selected items without valid ids', () => {
    const item = {
      id: null,
      pos: [100, 200],
      size: [160, 80],
      boundingRect: [100, 200, 160, 80]
    } as unknown as Positionable

    const { toolbox, visible, unmount } = renderToolboxForSelection([item])

    expect(visible.value).toBe(true)
    expect(toolbox.style.getPropertyValue('--tb-x')).toBe('')
    expect(toolbox.style.getPropertyValue('--tb-y')).toBe('')
    unmount()
  })

  it('stays visible without mutating style when the toolbox ref is empty', () => {
    const group = new LGraphGroup('Group', 1)
    group.pos = [100, 200]
    group.size = [160, 80]
    setCanvasSelection([group])

    let visible!: ReturnType<typeof useSelectionToolboxPosition>['visible']
    const TestHarness = defineComponent({
      setup() {
        ;({ visible } = useSelectionToolboxPosition(ref()))
        return () => h('div')
      }
    })

    const wrapper = render(TestHarness)

    expect(visible.value).toBe(true)
    wrapper.unmount()
  })

  it('hides and restores around Vue node drag state changes', async () => {
    if (!mockFeatureFlags.refs) {
      throw new Error('feature flag refs were not initialized')
    }
    mockFeatureFlags.refs.shouldRenderVueNodes.value = true
    const group = new LGraphGroup('Group', 1)
    group.pos = [100, 200]
    group.size = [160, 80]
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0)
    )
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      clearTimeout(handle)
    })

    const { visible, unmount } = renderToolboxForSelection([group])
    expect(visible.value).toBe(true)

    layoutStore.isDraggingVueNodes.value = true
    await nextTick()
    expect(visible.value).toBe(false)

    layoutStore.isDraggingVueNodes.value = false
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(visible.value).toBe(true)
    unmount()
  })
})
