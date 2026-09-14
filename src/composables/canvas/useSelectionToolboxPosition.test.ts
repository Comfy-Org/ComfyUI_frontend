import { render } from '@testing-library/vue'
import { defineComponent, h, markRaw, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSelectionToolboxPosition } from '@/composables/canvas/useSelectionToolboxPosition'
import type { Rect } from '@/lib/litegraph/src/interfaces'
import {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

const mockApp = vi.hoisted(() => ({
  canvas: null
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({ app: mockApp }))

vi.mock<unknown>(import('@/composables/useVueFeatureFlags'), () => ({
  useVueFeatureFlags: () => ({
    shouldRenderVueNodes: { value: false }
  })
}))

function createCanvas(graph: LGraph): LGraphCanvas {
  const canvasElement = document.createElement('canvas')
  canvasElement.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  return new LGraphCanvas(canvasElement, graph, { skip_render: true })
}

function addNode(graph: LGraph, x: number, y: number): LGraphNode {
  const node = new LGraphNode('Node')
  node.pos = [x, y]
  node.size = [160, 80]
  graph.add(node)
  return node
}

function addGroup(graph: LGraph, bounds: Rect): LGraphGroup {
  const group = new LGraphGroup('Group')
  group._bounding.set(bounds)
  graph.add(group)
  return group
}

describe('useSelectionToolboxPosition', () => {
  let graph: LGraph
  let canvas: LGraphCanvas

  beforeEach(() => {
    LiteGraph.vueNodesMode = false
    graph = new LGraph()
    canvas = createCanvas(graph)
    useCanvasStore().canvas = markRaw(canvas)
  })

  function renderToolbox() {
    let toolbox: HTMLElement | undefined
    let visible: Ref<boolean> | undefined
    const TestHarness = defineComponent({
      setup() {
        const toolboxRef = ref<HTMLElement>(document.createElement('div'))
        toolbox = toolboxRef.value
        visible = useSelectionToolboxPosition(toolboxRef).visible
        return () => h('div')
      }
    })

    const wrapper = render(TestHarness)
    if (!toolbox || !visible) throw new Error('Toolbox was not initialized')

    return { toolbox, visible, unmount: wrapper.unmount }
  }

  it('positions groups from their unchanged bounds', () => {
    const group = addGroup(graph, [100, 200, 160, 80])
    canvas.select(group)

    const { toolbox, unmount } = renderToolbox()

    expect(toolbox.style.getPropertyValue('--tb-y')).toBe('190px')
    unmount()
  })

  it('positions nodes from bounds that include the title bar', () => {
    canvas.select(addNode(graph, 100, 200))

    const { toolbox, unmount } = renderToolbox()

    expect(toolbox.style.getPropertyValue('--tb-y')).toBe(
      `${190 - LiteGraph.NODE_TITLE_HEIGHT}px`
    )
    unmount()
  })

  it('shows while the canvas selection is non-empty', async () => {
    const node = addNode(graph, 100, 200)
    const { visible, unmount } = renderToolbox()
    expect(visible.value).toBe(false)

    canvas.select(node)
    await nextTick()
    expect(visible.value).toBe(true)

    canvas.deselectAll()
    await nextTick()
    expect(visible.value).toBe(false)
    unmount()
  })

  it('follows a selected node that moves without a selection change', async () => {
    const node = addNode(graph, 100, 200)
    canvas.select(node)
    const { toolbox, unmount } = renderToolbox()
    const initialY = toolbox.style.getPropertyValue('--tb-y')

    node.pos = [100, 400]
    await nextTick()

    expect(toolbox.style.getPropertyValue('--tb-y')).toBe(
      `${390 - LiteGraph.NODE_TITLE_HEIGHT}px`
    )
    expect(toolbox.style.getPropertyValue('--tb-y')).not.toBe(initialY)
    unmount()
  })
})
