import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    querySlotAtPoint: vi.fn(),
    queryRerouteAtPoint: vi.fn(),
    getNodeLayoutRef: vi.fn(() => ({ value: null })),
    getSlotLayout: vi.fn(),
    setSource: vi.fn(),
    setActor: vi.fn()
  }
}))

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
    vi.useFakeTimers()
    ;({ canvas, canvasElement, node } = createGhostTestHarness())
    // Near left edge so autopan fires by default
    canvas.mouse[0] = 5
    canvas.mouse[1] = 300
  })

  afterEach(() => {
    if (canvas.state.ghostNodeId != null) canvas.finalizeGhostPlacement(false)
    canvasElement.remove()
    vi.useRealTimers()
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

describe('LGraphCanvas ghost placement cancellation via document keydown', () => {
  let canvas: LGraphCanvas
  let canvasElement: HTMLCanvasElement
  let graph: LGraph
  let node: LGraphNode

  beforeEach(() => {
    ;({ canvas, canvasElement, graph, node } = createGhostTestHarness())
  })

  afterEach(() => {
    if (canvas.state.ghostNodeId != null) canvas.finalizeGhostPlacement(false)
    canvasElement.remove()
  })

  it('Escape on document removes the ghost node and clears ghost state', async () => {
    canvas.startGhostPlacement(node)
    expect(canvas.state.ghostNodeId).toBe(node.id)

    await userEvent.keyboard('{Escape}')

    expect(canvas.state.ghostNodeId).toBeNull()
    expect(graph.getNodeById(node.id)).toBeFalsy()
  })

  it('Escape on document stops propagation so window-level keybindings do not fire', async () => {
    const windowSpy = vi.fn()
    window.addEventListener('keydown', windowSpy)
    try {
      canvas.startGhostPlacement(node)
      await userEvent.keyboard('{Escape}')
      expect(windowSpy).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', windowSpy)
    }
  })

  it('Delete and Backspace also cancel ghost placement', async () => {
    canvas.startGhostPlacement(node)
    await userEvent.keyboard('{Delete}')
    expect(canvas.state.ghostNodeId).toBeNull()
    expect(graph.getNodeById(node.id)).toBeFalsy()

    const node2 = new LGraphNode('test-2')
    node2.size = [200, 100]
    graph.add(node2)
    canvas.startGhostPlacement(node2)
    await userEvent.keyboard('{Backspace}')
    expect(canvas.state.ghostNodeId).toBeNull()
    expect(graph.getNodeById(node2.id)).toBeFalsy()
  })

  it('non-cancel keys do not finalize ghost placement', async () => {
    canvas.startGhostPlacement(node)
    const windowSpy = vi.fn()
    window.addEventListener('keydown', windowSpy)
    try {
      await userEvent.keyboard('a')
      expect(canvas.state.ghostNodeId).toBe(node.id)
      expect(windowSpy).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', windowSpy)
    }
  })

  it('keydown listener is removed when ghost placement finalizes', async () => {
    canvas.startGhostPlacement(node)
    canvas.finalizeGhostPlacement(false)

    const windowSpy = vi.fn()
    window.addEventListener('keydown', windowSpy)
    try {
      await userEvent.keyboard('{Escape}')
      expect(windowSpy).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', windowSpy)
    }
  })

  it('switching the active graph cancels any in-flight ghost', async () => {
    canvas.startGhostPlacement(node)
    expect(canvas.state.ghostNodeId).toBe(node.id)

    canvas.setGraph(new LGraph())

    expect(canvas.state.ghostNodeId).toBeNull()
    expect(graph.getNodeById(node.id)).toBeFalsy()

    // Listener should also be gone — Escape should reach the window now
    const windowSpy = vi.fn()
    window.addEventListener('keydown', windowSpy)
    try {
      await userEvent.keyboard('{Escape}')
      expect(windowSpy).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', windowSpy)
    }
  })

  it('calling startGhostPlacement again cancels the previous ghost without leaking listeners', async () => {
    canvas.startGhostPlacement(node)

    const node2 = new LGraphNode('test-2')
    node2.size = [200, 100]
    graph.add(node2)
    canvas.startGhostPlacement(node2)

    expect(graph.getNodeById(node.id)).toBeFalsy()
    expect(canvas.state.ghostNodeId).toBe(node2.id)

    canvas.finalizeGhostPlacement(true)

    const windowSpy = vi.fn()
    window.addEventListener('keydown', windowSpy)
    try {
      await userEvent.keyboard('{Escape}')
      // If a stale listener leaked, it would have stopPropagation'd this Escape.
      expect(windowSpy).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', windowSpy)
    }
  })

  it('removes listeners and resets transient drag state when ghostNodeId was already cleared', async () => {
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

    const windowSpy = vi.fn()
    window.addEventListener('keydown', windowSpy)
    try {
      await userEvent.keyboard('{Escape}')
      expect(windowSpy).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', windowSpy)
    }
  })
})
