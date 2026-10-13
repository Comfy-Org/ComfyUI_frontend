import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { attachKeyboard } from '@/lib/litegraph/src/__fixtures__/canvasHarness'
import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

vi.mock(import('@/renderer/core/layout/store/layoutStore'))

function createGhostTestHarness() {
  const canvasElement = document.createElement('canvas')
  canvasElement.width = 800
  canvasElement.height = 600
  canvasElement.getContext = vi
    .fn()
    .mockReturnValue(createMockCanvasRenderingContext2D())
  document.body.appendChild(canvasElement)
  canvasElement.getBoundingClientRect = vi.fn().mockReturnValue({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => {}
  })

  const graph = new LGraph()
  const canvas = new LGraphCanvas(canvasElement, graph, {
    skip_render: true,
    skip_events: true
  })

  const node = new LGraphNode('test')
  node.size = [200, 100]
  graph.add(node)

  return { canvas, canvasElement, graph, node }
}

describe('LGraphCanvas ghost placement auto-pan', () => {
  let canvas: LGraphCanvas
  let canvasElement: HTMLCanvasElement
  let node: LGraphNode

  beforeEach(() => {
    ;({ canvas, canvasElement, node } = createGhostTestHarness())
    // Near left edge so autopan fires by default
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
  })

  afterEach(() => {
    if (canvas.state.ghostNodeId != null) canvas.finalizeGhostPlacement(false)
    canvasElement.remove()
  })

  it('moves the ghost node when pointer is near edge', () => {
    canvas.startGhostPlacement(node)

    const posXBefore = node.pos[0]
    vi.advanceTimersByTime(16)

    expect(node.pos[0]).not.toBe(posXBefore)
  })

  it('does not pan when pointer is in the center', () => {
    canvas.mouse[0] = 400
    canvas.startGhostPlacement(node)

    const offsetBefore = [...canvas.ds.offset]
    vi.advanceTimersByTime(16)

    expect(canvas.ds.offset[0]).toBe(offsetBefore[0])
    expect(canvas.ds.offset[1]).toBe(offsetBefore[1])
  })

  it('cleans up autopan and stops responding to document pointermove on finalize', () => {
    const processMoveSpy = vi.spyOn(canvas, 'processMouseMove')
    canvas.startGhostPlacement(node)
    expect(canvas['_autoPan']).not.toBeNull()

    document.dispatchEvent(new MouseEvent('pointermove'))
    expect(processMoveSpy).toHaveBeenCalled()

    processMoveSpy.mockClear()
    canvas.finalizeGhostPlacement(false)

    expect(canvas['_autoPan']).toBeNull()

    document.dispatchEvent(new MouseEvent('pointermove'))
    expect(processMoveSpy).not.toHaveBeenCalled()
  })

  it('survives linkConnector reset during ghost placement', () => {
    canvas.startGhostPlacement(node)

    canvas.linkConnector.reset()

    expect(canvas['_autoPan']).not.toBeNull()
    vi.advanceTimersByTime(16)
    expect(canvas.ds.offset[0]).not.toBe(0)
  })
})

describe('LGraphCanvas ghost placement cancellation shortcuts', () => {
  let canvas: LGraphCanvas
  let canvasElement: HTMLCanvasElement
  let graph: LGraph
  let node: LGraphNode
  let keyboard: ReturnType<typeof attachKeyboard>

  beforeEach(() => {
    ;({ canvas, canvasElement, graph, node } = createGhostTestHarness())
    keyboard = attachKeyboard(canvas)
  })

  afterEach(() => {
    keyboard.dispose()
    if (canvas.state.ghostNodeId != null) canvas.finalizeGhostPlacement(false)
    canvasElement.remove()
  })

  it('Escape removes the ghost node and clears ghost state', () => {
    canvas.startGhostPlacement(node)
    expect(canvas.state.ghostNodeId).toBe(node.id)

    keyboard.press('Escape')

    expect(canvas.state.ghostNodeId).toBeNull()
    expect(graph.getNodeById(node.id)).toBeFalsy()
  })

  it('Escape claims the key so workspace shortcuts do not also run', () => {
    canvas.startGhostPlacement(node)

    expect(keyboard.press('Escape').defaultPrevented).toBe(true)
  })

  it('Delete and Backspace also cancel ghost placement', () => {
    canvas.startGhostPlacement(node)
    keyboard.press('Delete')
    expect(canvas.state.ghostNodeId).toBeNull()
    expect(graph.getNodeById(node.id)).toBeFalsy()

    const node2 = new LGraphNode('test-2')
    node2.size = [200, 100]
    graph.add(node2)
    canvas.startGhostPlacement(node2)
    keyboard.press('Backspace')
    expect(canvas.state.ghostNodeId).toBeNull()
    expect(graph.getNodeById(node2.id)).toBeFalsy()
  })

  it('non-cancel keys do not finalize ghost placement', () => {
    canvas.startGhostPlacement(node)

    expect(keyboard.press('a').defaultPrevented).toBe(false)
    expect(canvas.state.ghostNodeId).toBe(node.id)
  })

  it('leaves Escape unclaimed once ghost placement finalizes', () => {
    canvas.startGhostPlacement(node)
    canvas.finalizeGhostPlacement(false)

    expect(keyboard.press('Escape').defaultPrevented).toBe(false)
  })

  it('switching the active graph cancels any in-flight ghost', () => {
    canvas.startGhostPlacement(node)
    expect(canvas.state.ghostNodeId).toBe(node.id)

    canvas.setGraph(new LGraph())

    expect(canvas.state.ghostNodeId).toBeNull()
    expect(graph.getNodeById(node.id)).toBeFalsy()
    expect(keyboard.press('Escape').defaultPrevented).toBe(false)
  })

  it('calling startGhostPlacement again cancels the previous ghost', () => {
    canvas.startGhostPlacement(node)

    const node2 = new LGraphNode('test-2')
    node2.size = [200, 100]
    graph.add(node2)
    canvas.startGhostPlacement(node2)

    expect(graph.getNodeById(node.id)).toBeFalsy()
    expect(canvas.state.ghostNodeId).toBe(node2.id)

    canvas.finalizeGhostPlacement(true)

    expect(keyboard.press('Escape').defaultPrevented).toBe(false)
  })

  it('removes listeners and resets transient drag state when ghostNodeId was already cleared', () => {
    const processMoveSpy = vi.spyOn(canvas, 'processMouseMove')
    canvas.startGhostPlacement(node)
    expect(canvas.isDragging).toBe(true)
    expect(canvas['_autoPan']).not.toBeNull()

    canvas.state.ghostNodeId = null

    canvas.finalizeGhostPlacement(true)

    expect(canvas.isDragging).toBe(false)
    expect(canvas['_autoPan']).toBeNull()

    document.dispatchEvent(new MouseEvent('pointermove'))
    expect(processMoveSpy).not.toHaveBeenCalled()
    expect(keyboard.press('Escape').defaultPrevented).toBe(false)
  })

  it('does not clobber unrelated drag state when called with no ghost in flight', () => {
    const fakeAutoPan = { stop: vi.fn() }
    canvas.isDragging = true
    canvas['_autoPan'] = fakeAutoPan as unknown as (typeof canvas)['_autoPan']

    canvas.finalizeGhostPlacement(true)

    expect(canvas.isDragging).toBe(true)
    expect(canvas['_autoPan']).toBe(fakeAutoPan)
    expect(fakeAutoPan.stop).not.toHaveBeenCalled()
  })
})
