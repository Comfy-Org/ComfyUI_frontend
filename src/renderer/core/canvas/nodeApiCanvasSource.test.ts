import { reportError } from '@comfyorg/telemetry/reportError'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeApiCanvasSource } from '@/renderer/core/canvas/nodeApiCanvasSource'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

afterEach(() => {
  layoutStore.resetForTests()
})

function canvasWithNodes() {
  stubCanvasGetContext()
  const graph = new LGraph()
  const first = new LGraphNode('First')
  const second = new LGraphNode('Second')
  graph.add(first)
  graph.add(second)
  const canvas = new LGraphCanvas(document.createElement('canvas'), graph, {
    skip_render: true
  })
  useCanvasStore().canvas = canvas
  useCanvasStore().currentGraph = graph
  return { graph, first, second, canvas, source: useNodeApiCanvasSource() }
}

describe('the canvas the node API reads', () => {
  it('reads the graph and canvas on screen', () => {
    const { graph, canvas, source } = canvasWithNodes()

    expect(source.visibleGraph()).toBe(graph)
    expect(source.canvas()).toBe(canvas)
  })

  it('passes on a node move and the moves of a batch, leaving out a resize', () => {
    const { graph, first, second, source } = canvasWithNodes()
    const moved = vi.fn()
    source.followMoves(moved)

    useLayoutMutations(LayoutSource.Canvas).moveNode(graph.id, first.id, {
      x: 1,
      y: 2
    })
    layoutStore.batchUpdateNodeBounds(
      graph.id,
      [
        {
          nodeId: first.id,
          bounds: { x: 3, y: 4, width: first.size[0], height: first.size[1] }
        },
        {
          nodeId: second.id,
          bounds: { x: 5, y: 6, width: 999, height: 999 }
        }
      ],
      { source: LayoutSource.Canvas }
    )
    layoutStore.flushPendingChanges()

    expect(moved.mock.calls).toEqual([
      [graph.id, [{ nodeId: first.id, x: 1, y: 2 }]],
      [graph.id, [{ nodeId: first.id, x: 3, y: 4 }]]
    ])
  })

  it('passes on nothing for a layout change that moves no node', () => {
    const { graph, second, source } = canvasWithNodes()
    const moved = vi.fn()
    source.followMoves(moved)

    useLayoutMutations(LayoutSource.Canvas).setNodeZIndex(
      graph.id,
      second.id,
      9
    )
    layoutStore.flushPendingChanges()

    expect(moved).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('stops passing on moves once stopped', () => {
    const { graph, first, source } = canvasWithNodes()
    const moved = vi.fn()
    const stop = source.followMoves(moved)

    stop()
    useLayoutMutations(LayoutSource.Canvas).moveNode(graph.id, first.id, {
      x: 1,
      y: 2
    })
    layoutStore.flushPendingChanges()

    expect(moved).not.toHaveBeenCalled()
  })

  it('says a drag ended under either renderer, and not when one starts', async () => {
    const { canvas, source } = canvasWithNodes()
    const ended = vi.fn()
    source.followDragEnds(ended)

    canvas.isDragging = true
    layoutStore.isDraggingVueNodes.value = true
    await nextTick()

    expect(ended).not.toHaveBeenCalled()

    canvas.isDragging = false
    layoutStore.isDraggingVueNodes.value = false
    await nextTick()

    expect(ended).toHaveBeenCalledTimes(2)
  })

  it('stops following drags once stopped', async () => {
    const { canvas, source } = canvasWithNodes()
    const ended = vi.fn()
    const stop = source.followDragEnds(ended)

    stop()
    canvas.isDragging = true
    canvas.isDragging = false
    layoutStore.isDraggingVueNodes.value = true
    await nextTick()
    layoutStore.isDraggingVueNodes.value = false
    await nextTick()

    expect(ended).not.toHaveBeenCalled()
  })
})

describe("onViewportChanged beside the canvas store's scale sync", () => {
  function viewportListener() {
    const { graph, canvas, source } = canvasWithNodes()
    const { comfy } = createComfyApi({
      getGraph: () => graph,
      canvas: () => source
    })
    const changed = vi.fn()
    const pan = () => {
      canvas.ds.offset[0] += 10
      canvas.ds.computeVisibleArea(canvas.viewport)
    }
    return { comfy, changed, pan }
  }

  it('goes silent when the canvas menu unmounts after the pack subscribed, and stays silent when it mounts again', () => {
    const { comfy, changed, pan } = viewportListener()
    const canvasStore = useCanvasStore()
    canvasStore.initScaleSync()
    comfy.onViewportChanged(changed)

    pan()

    expect(changed).toHaveBeenCalledOnce()

    canvasStore.cleanupScaleSync()
    pan()
    canvasStore.initScaleSync()
    pan()

    expect(changed).toHaveBeenCalledOnce()
  })

  it('keeps hearing when the pack subscribed before the canvas menu mounted', () => {
    const { comfy, changed, pan } = viewportListener()
    const canvasStore = useCanvasStore()
    comfy.onViewportChanged(changed)
    canvasStore.initScaleSync()

    canvasStore.cleanupScaleSync()
    pan()

    expect(changed).toHaveBeenCalledOnce()
  })

  it('hears again once every listener has left and one subscribes', () => {
    const { comfy, changed, pan } = viewportListener()
    const canvasStore = useCanvasStore()
    canvasStore.initScaleSync()
    const stop = comfy.onViewportChanged(vi.fn())
    canvasStore.cleanupScaleSync()

    stop()
    comfy.onViewportChanged(changed)
    pan()

    expect(changed).toHaveBeenCalledOnce()
  })
})
