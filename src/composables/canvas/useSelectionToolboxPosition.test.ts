import { render } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { defineComponent, h, markRaw, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSelectionToolboxPosition } from '@/composables/canvas/useSelectionToolboxPosition'
import type { Rect } from '@comfyorg/shared-frontend-utils/geometry'
import { runCanvasFramePhase } from '@/lib/litegraph/src/canvas/canvasFrame'
import {
  LGraph,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/canvasTestUtils'

vi.mock(import('@/scripts/app'))

vi.mock<unknown>(import('@/composables/useVueFeatureFlags'), () => ({
  useVueFeatureFlags: () => ({
    shouldRenderVueNodes: { value: false }
  })
}))

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

function toolboxOffset(toolbox: HTMLElement) {
  const [x, y] =
    toolbox.style.transform.match(/-?\d+(?:\.\d+)?(?=px)/g)?.map(Number) ?? []
  return { x, y }
}

describe('useSelectionToolboxPosition', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let lift: Ref<number>

  beforeEach(() => {
    lift = ref(0)
    LiteGraph.vueNodesMode = false
    graph = new LGraph()
    canvas = createTestCanvas(graph, createMockCanvasRenderingContext2D())
    useCanvasStore().canvas = markRaw(canvas)
  })

  function renderToolbox() {
    let toolbox: HTMLElement | undefined
    let visible: Ref<boolean> | undefined
    const TestHarness = defineComponent({
      setup() {
        const toolboxRef = ref<HTMLElement>(document.createElement('div'))
        toolbox = toolboxRef.value
        visible = useSelectionToolboxPosition(toolboxRef, lift).visible
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

    expect(toolboxOffset(toolbox).y).toBe(190)
    unmount()
  })

  it('positions nodes from bounds that include the title bar', () => {
    canvas.select(addNode(graph, 100, 200))

    const { toolbox, unmount } = renderToolbox()

    expect(toolboxOffset(toolbox).y).toBe(190 - LiteGraph.NODE_TITLE_HEIGHT)
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
    const initialY = toolboxOffset(toolbox).y

    node.pos = [100, 400]
    await nextTick()

    expect(toolboxOffset(toolbox).y).toBe(390 - LiteGraph.NODE_TITLE_HEIGHT)
    expect(toolboxOffset(toolbox).y).not.toBe(initialY)
    unmount()
  })

  it('follows the canvas transform on each presented frame', () => {
    canvas.select(addNode(graph, 100, 200))
    const { toolbox, unmount } = renderToolbox()
    const initialX = toolboxOffset(toolbox).x

    canvas.ds.offset[0] += 50
    runCanvasFramePhase(canvas, 'present')

    expect(toolboxOffset(toolbox).x).toBe(initialX + 50)
    unmount()
  })

  it('eases up by the lift and holds its place until the lift has eased away', async () => {
    const node = addNode(graph, 100, 200)
    canvas.select(node)
    const { toolbox, unmount } = renderToolbox()

    lift.value = 51
    node.pos = [100, 400]
    await vi.waitFor(() =>
      expect(toolboxOffset(toolbox).y).toBe(
        190 - LiteGraph.NODE_TITLE_HEIGHT - 51
      )
    )

    lift.value = 0
    await nextTick()
    expect(toolboxOffset(toolbox).y).toBe(
      190 - LiteGraph.NODE_TITLE_HEIGHT - 51
    )
    await vi.waitFor(() =>
      expect(toolboxOffset(toolbox).y).toBe(390 - LiteGraph.NODE_TITLE_HEIGHT)
    )
    unmount()
  })

  it('moves to a new selection straight away while the lift eases away', async () => {
    const first = addNode(graph, 100, 200)
    const second = addNode(graph, 100, 600)
    canvas.select(first)
    const { toolbox, unmount } = renderToolbox()
    lift.value = 51
    await vi.waitFor(() =>
      expect(toolboxOffset(toolbox).y).toBe(
        190 - LiteGraph.NODE_TITLE_HEIGHT - 51
      )
    )

    lift.value = 0
    canvas.deselectAll()
    canvas.select(second)
    await nextTick()

    expect(toolboxOffset(toolbox).y).toBeGreaterThanOrEqual(
      590 - LiteGraph.NODE_TITLE_HEIGHT - 51
    )
    expect(toolboxOffset(toolbox).y).toBeLessThanOrEqual(
      590 - LiteGraph.NODE_TITLE_HEIGHT
    )
    await vi.waitFor(() =>
      expect(toolboxOffset(toolbox).y).toBe(590 - LiteGraph.NODE_TITLE_HEIGHT)
    )
    unmount()
  })

  it('holds its place while lifted when a group joins the selection', async () => {
    const node = addNode(graph, 100, 200)
    canvas.select(node)
    const { toolbox, unmount } = renderToolbox()
    lift.value = 51
    const liftedY = 190 - LiteGraph.NODE_TITLE_HEIGHT - 51
    await vi.waitFor(() => expect(toolboxOffset(toolbox).y).toBe(liftedY))

    canvas.select(addGroup(graph, [100, 0, 160, 80]))
    await nextTick()

    expect(toolboxOffset(toolbox).y).toBe(liftedY)
    unmount()
  })

  it('moves to a new link-only selection while the lift eases away', async () => {
    const source = addNode(graph, 100, 200)
    const target = addNode(graph, 400, 200)
    source.addOutput('out', '*')
    target.addInput('in', '*')
    const link = source.connect(0, target, 0)
    assert.exists(link)
    const selectionStore = useLinkSelectionStore()
    selectionStore.selection = {
      links: [link],
      anchorX: 300,
      marquee: { x: 300, y: 200, width: 0, height: 0 }
    }
    const { toolbox, unmount } = renderToolbox()
    lift.value = 51
    await vi.waitFor(() => expect(toolboxOffset(toolbox).y).toBe(139))

    lift.value = 0
    selectionStore.selection = {
      links: [link],
      anchorX: 350,
      marquee: { x: 350, y: 600, width: 0, height: 0 }
    }
    await nextTick()

    expect(toolboxOffset(toolbox).y).toBeGreaterThanOrEqual(539)
    expect(toolboxOffset(toolbox).x).toBe(350)
    await vi.waitFor(() => expect(toolboxOffset(toolbox).y).toBe(590))
    unmount()
  })

  it('moves to the selection when it reappears while the lift eases away', async () => {
    const node = addNode(graph, 100, 200)
    canvas.select(node)
    const { toolbox, visible, unmount } = renderToolbox()
    lift.value = 51
    await vi.waitFor(() =>
      expect(toolboxOffset(toolbox).y).toBe(
        190 - LiteGraph.NODE_TITLE_HEIGHT - 51
      )
    )

    lift.value = 0
    canvas.state.draggingItems = true
    node.pos = [100, 400]
    await nextTick()
    canvas.isDragging = false
    await new Promise(requestAnimationFrame)

    expect(visible.value).toBe(true)
    expect(toolboxOffset(toolbox).y).toBeGreaterThanOrEqual(
      390 - LiteGraph.NODE_TITLE_HEIGHT - 51
    )
    expect(toolboxOffset(toolbox).y).toBeLessThanOrEqual(
      390 - LiteGraph.NODE_TITLE_HEIGHT
    )
    await vi.waitFor(() =>
      expect(toolboxOffset(toolbox).y).toBe(390 - LiteGraph.NODE_TITLE_HEIGHT)
    )
    unmount()
  })

  it('settles back down after reduced motion is switched off mid-lift', async () => {
    const reducedMotion = Object.assign(new EventTarget(), {
      matches: false,
      media: '(prefers-reduced-motion: reduce)'
    })
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      fromPartial<MediaQueryList>(reducedMotion)
    )
    const setReducedMotion = (matches: boolean) => {
      reducedMotion.matches = matches
      reducedMotion.dispatchEvent(
        Object.assign(new Event('change'), { matches })
      )
    }
    const node = addNode(graph, 100, 200)
    canvas.select(node)
    const { toolbox, unmount } = renderToolbox()
    lift.value = 51
    await vi.waitFor(() =>
      expect(toolboxOffset(toolbox).y).toBe(
        190 - LiteGraph.NODE_TITLE_HEIGHT - 51
      )
    )

    setReducedMotion(true)
    await nextTick()
    lift.value = 0
    await nextTick()
    setReducedMotion(false)
    node.pos = [100, 400]

    await vi.waitFor(() =>
      expect(toolboxOffset(toolbox).y).toBe(390 - LiteGraph.NODE_TITLE_HEIGHT)
    )
    unmount()
  })

  it('observes direct LiteGraph drag state writes and returns after drag', async () => {
    const node = addNode(graph, 100, 200)
    canvas.select(node)
    const { visible, unmount } = renderToolbox()
    expect(visible.value).toBe(true)

    canvas.state.draggingItems = true
    node.pos = [100, 400]
    await nextTick()
    expect(visible.value).toBe(false)

    canvas.isDragging = false
    await new Promise(requestAnimationFrame)
    expect(visible.value).toBe(true)
    unmount()
  })
})
