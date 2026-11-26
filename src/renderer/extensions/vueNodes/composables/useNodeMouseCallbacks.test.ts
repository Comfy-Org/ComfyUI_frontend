import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, useTemplateRef } from 'vue'

import { reportError } from '@comfyorg/telemetry/reportError'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { LGraph, LGraphCanvas, LGraphNode } from '@comfyorg/litegraph/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { createMockCanvasRenderingContext2D } from '@comfyorg/litegraph/__fixtures__/canvasTestUtils'

import { useNodeMouseCallbacks } from './useNodeMouseCallbacks'

vi.mock(import('@/scripts/app'))
vi.mock(import('@comfyorg/telemetry/reportError'))

function createCanvas(graph: LGraph) {
  const canvasElement = document.createElement('canvas')
  canvasElement.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  const canvas = new LGraphCanvas(canvasElement, graph, {
    skip_render: true,
    skip_events: true
  })
  useCanvasStore().canvas = canvas
  return canvas
}

async function renderHoverHost(nodeId: NodeId) {
  const Host = defineComponent(() => {
    const root = useTemplateRef<HTMLElement>('root')
    useNodeMouseCallbacks(nodeId, root)
    return () =>
      h('div', { ref: 'root', 'data-testid': 'node' }, [
        h('canvas', {
          'data-testid': 'widget',
          onPointermove: (e: PointerEvent) => e.stopPropagation()
        })
      ])
  })
  render(Host)
  await nextTick()
  const nodeEl = screen.getByTestId('node')
  const widgetEl = screen.getByTestId('widget')
  return {
    enter: () =>
      nodeEl.dispatchEvent(
        new PointerEvent('pointerenter', { clientX: 130, clientY: 245 })
      ),
    move: () =>
      widgetEl.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: 130,
          clientY: 245,
          bubbles: true
        })
      ),
    leave: () =>
      nodeEl.dispatchEvent(
        new PointerEvent('pointerleave', { clientX: 600, clientY: 245 })
      ),
    down: () =>
      widgetEl.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: 130,
          clientY: 245,
          button: 0,
          pointerId: 1,
          bubbles: true
        })
      ),
    release: (pointerId = 1) =>
      window.dispatchEvent(
        new PointerEvent('pointerup', { button: 0, pointerId })
      )
  }
}

function recordHover(node: LGraphNode, calls: [string, number[]?][]) {
  node.onMouseEnter = () => calls.push(['enter'])
  node.onMouseMove = (_e, pos) => calls.push(['move', [...pos]])
  node.onMouseLeave = () => calls.push(['leave'])
}

describe('useNodeMouseCallbacks', () => {
  let throwingNodeTypes = 0

  it('calls the node hover callbacks with node-relative positions, even when a widget stops propagation', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('Comparer')
    node.pos = [100, 200]
    graph.add(node)
    const calls: [string, number[]?][] = []
    recordHover(node, calls)
    createCanvas(graph)
    await nextTick()

    const pointer = await renderHoverHost(node.id)
    pointer.enter()
    pointer.move()
    pointer.leave()

    expect(calls).toEqual([['enter'], ['move', [30, 45]], ['leave']])
  })

  it('calls onMouseDown with a node-relative position and reports the canvas pointer down until release', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('Comparer')
    node.pos = [100, 200]
    graph.add(node)
    const canvas = createCanvas(graph)
    const downs: { pos: number[]; pointerIsDown: boolean }[] = []
    node.onMouseDown = (_e, pos, eventCanvas) => {
      downs.push({ pos: [...pos], pointerIsDown: eventCanvas.pointer_is_down })
      return false
    }
    await nextTick()

    const pointer = await renderHoverHost(node.id)
    pointer.down()
    pointer.release(2)
    const heldAfterOtherPointerRelease = canvas.pointer_is_down
    pointer.release()

    expect(downs).toEqual([{ pos: [30, 45], pointerIsDown: true }])
    expect(heldAfterOtherPointerRelease).toBe(true)
    expect(canvas.pointer_is_down).toBe(false)
  })

  it('does not call onMouseDown while the canvas is select-only', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('Comparer')
    graph.add(node)
    const canvas = createCanvas(graph)
    canvas.selectOnly = true
    const onMouseDown = vi.fn(() => false)
    node.onMouseDown = onMouseDown
    await nextTick()

    const pointer = await renderHoverHost(node.id)
    pointer.down()

    expect(onMouseDown).not.toHaveBeenCalled()
    expect(canvas.pointer_is_down).toBe(false)
  })

  it('delivers the leave to the node that received the enter after the graph changes', async () => {
    const entered = new LGraphNode('Comparer')
    const firstGraph = new LGraph()
    firstGraph.add(entered)
    const sameId = new LGraphNode('Comparer')
    const secondGraph = new LGraph()
    secondGraph.add(sameId)
    expect(sameId.id).toBe(entered.id)
    const enteredCalls: [string, number[]?][] = []
    const sameIdCalls: [string, number[]?][] = []
    recordHover(entered, enteredCalls)
    recordHover(sameId, sameIdCalls)
    const canvas = createCanvas(firstGraph)
    await nextTick()

    const pointer = await renderHoverHost(entered.id)
    pointer.enter()
    canvas.setGraph(secondGraph)
    pointer.leave()

    expect(enteredCalls).toEqual([['enter'], ['leave']])
    expect(sameIdCalls).toEqual([])
  })

  it('reports a throwing hover callback once and keeps delivering the others', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('ThrowingHover')
    node.type = `ThrowingHover-${++throwingNodeTypes}`
    graph.add(node)
    const calls: [string, number[]?][] = []
    recordHover(node, calls)
    node.onMouseMove = () => {
      throw new Error('hover failed')
    }
    createCanvas(graph)
    await nextTick()

    const pointer = await renderHoverHost(node.id)
    pointer.enter()
    pointer.move()
    pointer.move()
    pointer.leave()

    expect(calls).toEqual([['enter'], ['leave']])
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'failure_invoking_node_mouse_callback'
      })
    )
  })
})
