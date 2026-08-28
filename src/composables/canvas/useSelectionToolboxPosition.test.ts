import { render } from '@testing-library/vue'
import { defineComponent, h, markRaw, nextTick, reactive, ref } from 'vue'
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
import { toGroupId } from '@/types/groupId'
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
    canvasStore = useCanvasStore()
  })

  function renderToolboxForSelection(item: Positionable, selectOnly = false) {
    canvasStore.canvas = markRaw({
      canvas: document.createElement('canvas'),
      ds: {
        offset: [0, 0],
        scale: 1
      },
      selectOnly,
      selectedItems: new Set([item]),
      state: {
        draggingItems: false,
        selectionChanged: true
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
    const group = new LGraphGroup('Group', toGroupId(1))
    group.pos = [100, 200]
    group.size = [160, 80]

    const { toolbox, unmount } = renderToolboxForSelection(group)

    expect(toolbox.style.getPropertyValue('--tb-y')).toBe('190px')
    unmount()
  })

  it('positions nodes from bounds that include the title bar', () => {
    const node = new LGraphNode('Node')
    node.id = toNodeId(1)
    node.pos = [100, 200]
    node.size = [160, 80]

    const { toolbox, unmount } = renderToolboxForSelection(node)

    expect(toolbox.style.getPropertyValue('--tb-y')).toBe(
      `${190 - LiteGraph.NODE_TITLE_HEIGHT}px`
    )
    unmount()
  })

  it('stays hidden for a selection made in selection-only mode', () => {
    const node = new LGraphNode('Node')
    node.id = toNodeId(1)
    node.pos = [100, 200]
    node.size = [160, 80]

    const { toolbox, unmount } = renderToolboxForSelection(node, true)

    expect(toolbox.style.getPropertyValue('--tb-y')).toBe('')
    unmount()
  })

  it('hides when select-only mode begins and re-evaluates when it ends', async () => {
    const node = new LGraphNode('Node')
    node.id = toNodeId(1)
    node.pos = [100, 200]
    node.size = [160, 80]

    // Mirrors app.ts: canvas state is reactive, so the mode watcher fires.
    const state = reactive({
      draggingItems: false,
      selectionChanged: true,
      selectOnly: false
    })
    canvasStore.canvas = markRaw({
      canvas: document.createElement('canvas'),
      ds: { offset: [0, 0], scale: 1 },
      get selectOnly() {
        return state.selectOnly
      },
      selectedItems: new Set([node]),
      state
    } as unknown as LGraphCanvas)

    let toolbox: HTMLElement | undefined
    let visible: { value: boolean } | undefined
    const TestHarness = defineComponent({
      setup() {
        const toolboxRef = ref<HTMLElement>(document.createElement('div'))
        toolbox = toolboxRef.value
        visible = useSelectionToolboxPosition(toolboxRef).visible
        return () => h('div')
      }
    })
    const wrapper = render(TestHarness)
    if (!toolbox || !visible) throw new Error('Harness was not initialized')

    expect(visible.value).toBe(true)
    expect(toolbox.style.getPropertyValue('--tb-y')).toBe(
      `${190 - LiteGraph.NODE_TITLE_HEIGHT}px`
    )

    state.selectOnly = true
    await nextTick()

    expect(visible.value).toBe(false)

    // Move the node while hidden: the restore must RE-EVALUATE, not replay.
    node.pos = [100, 300]
    state.selectOnly = false
    await nextTick()

    expect(visible.value).toBe(true)
    expect(toolbox.style.getPropertyValue('--tb-y')).toBe(
      `${290 - LiteGraph.NODE_TITLE_HEIGHT}px`
    )
    wrapper.unmount()
  })
})
