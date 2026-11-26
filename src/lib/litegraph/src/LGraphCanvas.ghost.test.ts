import userEvent from '@testing-library/user-event'
import { reportError } from '@comfyorg/telemetry/reportError'
import { describe, expect, it, vi } from 'vitest'

import { cancelGhostPlacement } from '@/lib/litegraph/src/canvas/ghostPlacement'
import type { LGraphCanvasEventMap } from '@/lib/litegraph/src/infrastructure/LGraphCanvasEventMap'
import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { AutoPanController } from '@/renderer/core/canvas/useAutoPan'
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

  return {
    canvas,
    canvasElement,
    graph,
    node,
    [Symbol.dispose]() {
      canvas.unbindEvents()
      canvas.stopRendering()
    }
  }
}

function createAutoPanTestHarness() {
  const harness = createGhostTestHarness()
  const { canvas } = harness
  vi.spyOn(canvas, 'draw').mockImplementation(() => {})
  canvas.startRendering()
  canvas.mouse[0] = 5
  canvas.mouse[1] = 300
  return harness
}

describe('LGraphCanvas ghost placement auto-pan', () => {
  it('moves the ghost node when pointer is near edge', () => {
    using harness = createAutoPanTestHarness()
    const { canvas, node } = harness
    canvas.startGhostPlacement(node)

    const posXBefore = node.pos[0]
    vi.advanceTimersByTime(16)

    expect(node.pos[0]).not.toBe(posXBefore)
  })

  it('does not pan when pointer is in the center', () => {
    using harness = createAutoPanTestHarness()
    const { canvas, node } = harness
    canvas.mouse[0] = 400
    canvas.startGhostPlacement(node)

    const offsetBefore = [...canvas.ds.offset]
    vi.advanceTimersByTime(16)

    expect(canvas.ds.offset[0]).toBe(offsetBefore[0])
    expect(canvas.ds.offset[1]).toBe(offsetBefore[1])
  })

  it('cleans up autopan and stops responding to document pointermove on finalize', () => {
    using harness = createAutoPanTestHarness()
    const { canvas, node } = harness
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
    using harness = createAutoPanTestHarness()
    const { canvas, node } = harness
    canvas.startGhostPlacement(node)

    canvas.linkConnector.reset()

    expect(canvas['_autoPan']).not.toBeNull()
    vi.advanceTimersByTime(16)
    expect(canvas.ds.offset[0]).not.toBe(0)
  })
})

describe('LGraphCanvas ghost placement cancellation via document keydown', () => {
  it('Escape on document removes the ghost node and clears ghost state', async () => {
    using harness = createGhostTestHarness()
    const { canvas, graph, node } = harness
    canvas.startGhostPlacement(node)
    expect(canvas.state.ghostNodeId).toBe(node.id)

    await userEvent.keyboard('{Escape}')

    expect(canvas.state.ghostNodeId).toBeNull()
    expect(graph.getNodeById(node.id)).toBeFalsy()
  })

  it('Escape on document stops propagation so window-level keybindings do not fire', async () => {
    using harness = createGhostTestHarness()
    const { canvas, node } = harness
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
    using harness = createGhostTestHarness()
    const { canvas, graph, node } = harness
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
    using harness = createGhostTestHarness()
    const { canvas, node } = harness
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
    using harness = createGhostTestHarness()
    const { canvas, node } = harness
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
    using harness = createGhostTestHarness()
    const { canvas, graph, node } = harness
    canvas.startGhostPlacement(node)
    expect(canvas.state.ghostNodeId).toBe(node.id)

    canvas.setGraph(new LGraph())

    expect(canvas.state.ghostNodeId).toBeNull()
    expect(graph.getNodeById(node.id)).toBeFalsy()

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
    using harness = createGhostTestHarness()
    const { canvas, graph, node } = harness
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
      expect(windowSpy).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', windowSpy)
    }
  })

  it('removes listeners and resets transient drag state when ghostNodeId was already cleared', async () => {
    using harness = createGhostTestHarness()
    const { canvas, graph, node } = harness
    const processMoveSpy = vi.spyOn(canvas, 'processMouseMove')
    canvas.startGhostPlacement(node)
    expect(canvas.isDragging).toBe(true)
    expect(canvas['_autoPan']).not.toBeNull()

    canvas.state.ghostNodeId = null

    cancelGhostPlacement(canvas)

    expect(graph.getNodeById(node.id)).toBeNull()
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

  it('cancelGhostPlacement removes an in-flight ghost node', () => {
    using harness = createGhostTestHarness()
    const { canvas, graph, node } = harness
    canvas.startGhostPlacement(node)

    cancelGhostPlacement(canvas)

    expect(canvas.state.ghostNodeId).toBeNull()
    expect(graph.getNodeById(node.id)).toBeFalsy()
  })

  it('cancelGhostPlacement is a no-op with no ghost in flight', () => {
    using harness = createGhostTestHarness()
    const { canvas, graph, node } = harness
    const autoPan = new AutoPanController({
      canvas,
      maxPanSpeed: 15,
      onPan: () => {}
    })
    const stop = vi.spyOn(autoPan, 'stop')
    canvas.isDragging = true
    canvas['_autoPan'] = autoPan

    cancelGhostPlacement(canvas)

    expect(graph.getNodeById(node.id)).toBe(node)
    expect(canvas.state.ghostNodeId).toBeNull()
    expect(canvas.isDragging).toBe(true)
    expect(canvas['_autoPan']).toBe(autoPan)
    expect(stop).not.toHaveBeenCalled()
  })

  it('does not clobber unrelated drag state when called with no ghost in flight', () => {
    using harness = createGhostTestHarness()
    const { canvas } = harness
    const autoPan = new AutoPanController({
      canvas,
      maxPanSpeed: 15,
      onPan: () => {}
    })
    const stop = vi.spyOn(autoPan, 'stop')
    canvas.isDragging = true
    canvas['_autoPan'] = autoPan

    canvas.finalizeGhostPlacement(true)

    expect(canvas.isDragging).toBe(true)
    expect(canvas['_autoPan']).toBe(autoPan)
    expect(stop).not.toHaveBeenCalled()
  })
})

function createGhostLifecycleTestHarness() {
  const harness = createGhostTestHarness()
  const changes: string[] = []
  const listeners = new AbortController()
  document.addEventListener(
    'litegraph:canvas',
    (event) => {
      if (!(event instanceof CustomEvent)) return
      const detail: unknown = event.detail
      if (typeof detail !== 'object' || detail === null) return
      if (
        'subType' in detail &&
        (detail.subType === 'before-change' ||
          detail.subType === 'after-change')
      ) {
        changes.push(detail.subType)
      }
    },
    { signal: listeners.signal }
  )
  return {
    ...harness,
    changes,
    listeners,
    [Symbol.dispose]() {
      listeners.abort()
      harness[Symbol.dispose]()
    }
  }
}

describe('LGraphCanvas ghost placement lifecycle', () => {
  it.for([
    {
      name: 'removing the pending node before cancellation',
      terminate: (canvas: LGraphCanvas, graph: LGraph, node: LGraphNode) => {
        graph.remove(node)
        canvas.finalizeGhostPlacement(true)
      }
    },
    {
      name: 'clearing the graph',
      terminate: (_canvas: LGraphCanvas, graph: LGraph) => graph.clear()
    },
    {
      name: 'unbinding canvas events',
      terminate: (canvas: LGraphCanvas) => canvas.unbindEvents()
    }
  ])('$name closes placement and releases document input', ({ terminate }) => {
    using harness = createGhostLifecycleTestHarness()
    const { canvas, graph, node, changes, listeners } = harness
    const move = vi
      .spyOn(canvas, 'processMouseMove')
      .mockImplementation(() => {})
    const windowKeydown = vi.fn()
    window.addEventListener('keydown', windowKeydown, {
      signal: listeners.signal
    })
    canvas.startGhostPlacement(node)

    terminate(canvas, graph, node)

    expect(canvas.state.ghostNodeId).toBeNull()
    expect(canvas.isDragging).toBe(false)
    expect(changes).toEqual(['before-change', 'after-change'])

    document.dispatchEvent(new MouseEvent('pointermove'))
    document.documentElement.dispatchEvent(new MouseEvent('pointerleave'))
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )

    expect(move).not.toHaveBeenCalled()
    expect(windowKeydown).toHaveBeenCalledOnce()
  })

  it('announces inactive placement even when an after-change callback throws', () => {
    using harness = createGhostLifecycleTestHarness()
    const { canvas, node, listeners } = harness
    const announcements: boolean[] = []
    canvas.canvas.addEventListener(
      'litegraph:ghost-placement',
      ({
        detail
      }: CustomEvent<LGraphCanvasEventMap['litegraph:ghost-placement']>) =>
        announcements.push(detail.active),
      { signal: listeners.signal }
    )
    canvas.startGhostPlacement(node)
    const failure = new Error('extension after-change failed')
    canvas.onAfterChange = () => {
      throw failure
    }

    expect(() => canvas.finalizeGhostPlacement(false)).toThrow(failure)

    expect(canvas.state.ghostNodeId).toBeNull()
    expect(node.flags.ghost).toBeUndefined()
    expect(announcements).toEqual([true, false])
  })

  it.for([
    { name: 'clear', teardown: (canvas: LGraphCanvas) => canvas.clear() },
    {
      name: 'unbindEvents',
      teardown: (canvas: LGraphCanvas) => canvas.unbindEvents()
    }
  ])('$name rejects replacement placement during teardown', ({ teardown }) => {
    using harness = createGhostLifecycleTestHarness()
    const { canvas, canvasElement, graph, node, listeners } = harness
    const replacement = new LGraphNode('replacement')
    graph.add(replacement)
    canvas.bindEvents()
    canvas.startGhostPlacement(node)
    function startReplacement() {
      canvasElement.removeEventListener(
        'litegraph:ghost-placement',
        startReplacement
      )
      canvas.startGhostPlacement(replacement)
    }
    canvasElement.addEventListener(
      'litegraph:ghost-placement',
      startReplacement,
      { signal: listeners.signal }
    )

    teardown(canvas)

    expect(graph.getNodeById(replacement.id)).toBeNull()
    expect(canvas.state.ghostNodeId).toBeNull()
    expect(canvas.isDragging).toBe(false)
    const move = vi
      .spyOn(canvas, 'processMouseMove')
      .mockImplementation(() => {})
    document.dispatchEvent(new MouseEvent('pointermove'))
    expect(move).not.toHaveBeenCalled()

    const later = new LGraphNode('later')
    graph.add(later)
    canvas.startGhostPlacement(later)
    expect(canvas.state.ghostNodeId).toBe(later.id)
  })

  it.for(['clear', 'unbindEvents'] as const)(
    '%s during startup blocks replacement through deferred completion',
    (teardown) => {
      using harness = createGhostLifecycleTestHarness()
      const { canvas, canvasElement, graph, node, changes, listeners } = harness
      const replacement = new LGraphNode('replacement')
      graph.add(replacement)
      canvas.bindEvents()
      function teardownDuringStartup() {
        canvasElement.removeEventListener(
          'litegraph:canvas',
          teardownDuringStartup
        )
        canvas[teardown]()
      }
      function startReplacement() {
        canvasElement.removeEventListener(
          'litegraph:ghost-placement',
          startReplacement
        )
        canvas.startGhostPlacement(replacement)
      }
      canvasElement.addEventListener(
        'litegraph:canvas',
        teardownDuringStartup,
        {
          signal: listeners.signal
        }
      )
      canvasElement.addEventListener(
        'litegraph:ghost-placement',
        startReplacement,
        { signal: listeners.signal }
      )

      canvas.startGhostPlacement(node)

      expect(graph.nodes).toEqual([])
      expect(canvas.state.ghostNodeId).toBeNull()
      expect(canvas.isDragging).toBe(false)
      expect(changes).toEqual(['before-change', 'after-change'])
    }
  )

  it('reports a removal failure while closing placement and releasing input', () => {
    using harness = createGhostLifecycleTestHarness()
    const { canvas, graph, node, changes } = harness
    const failure = new Error('extension removal failed')
    const move = vi
      .spyOn(canvas, 'processMouseMove')
      .mockImplementation(() => {})
    node.onRemoved = () => {
      throw failure
    }
    canvas.startGhostPlacement(node)

    expect(() => canvas.finalizeGhostPlacement(true)).not.toThrow()
    document.dispatchEvent(new MouseEvent('pointermove'))

    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      errorType: 'error_removing_ghost_node',
      surface: 'graph'
    })
    expect(graph.getNodeById(node.id)).toBeNull()
    expect(canvas.state.ghostNodeId).toBeNull()
    expect(canvas.isDragging).toBe(false)
    expect(changes).toEqual(['before-change', 'after-change'])
    expect(move).not.toHaveBeenCalled()
  })

  it.for([
    'litegraph:ghost-placement',
    'litegraph:dragging-items-changed'
  ] as const)(
    'removes only the original node when a %s listener switches graphs',
    (event) => {
      using harness = createGhostLifecycleTestHarness()
      const { canvas, graph, node, changes, listeners } = harness
      const replacement = new LGraph()
      const innocent = new LGraphNode('innocent')
      replacement.add(innocent)
      expect(innocent.id).toBe(node.id)
      canvas.startGhostPlacement(node)
      canvas.canvas.addEventListener(
        event,
        () => canvas.setGraph(replacement),
        { once: true, signal: listeners.signal }
      )

      canvas.finalizeGhostPlacement(true)

      expect(canvas.graph).toBe(replacement)
      expect(graph.getNodeById(node.id)).toBeNull()
      expect(replacement.getNodeById(innocent.id)).toBe(innocent)
      expect(changes).toEqual(['before-change', 'after-change'])
    }
  )

  it('recursive finalization removes the node and closes placement only once', () => {
    using harness = createGhostLifecycleTestHarness()
    const { canvas, graph, node, changes, listeners } = harness
    const removed = vi.fn()
    node.onRemoved = removed
    canvas.startGhostPlacement(node)
    canvas.canvas.addEventListener(
      'litegraph:ghost-placement',
      () => canvas.finalizeGhostPlacement(true),
      { once: true, signal: listeners.signal }
    )

    canvas.finalizeGhostPlacement(true)
    canvas.finalizeGhostPlacement(true)

    expect(removed).toHaveBeenCalledOnce()
    expect(graph.getNodeById(node.id)).toBeNull()
    expect(changes).toEqual(['before-change', 'after-change'])
  })

  it.for([
    {
      phase: 'active announcement',
      event: 'litegraph:ghost-placement'
    },
    {
      phase: 'before-change callback',
      event: 'litegraph:canvas'
    }
  ] satisfies {
    phase: string
    event: 'litegraph:ghost-placement' | 'litegraph:canvas'
  }[])(
    'cancellation during $phase does not resume placement startup',
    ({ event }) => {
      using harness = createGhostLifecycleTestHarness()
      const { canvas, graph, node, changes, listeners } = harness
      const move = vi
        .spyOn(canvas, 'processMouseMove')
        .mockImplementation(() => {})
      const windowKeydown = vi.fn()
      window.addEventListener('keydown', windowKeydown, {
        signal: listeners.signal
      })
      const cancel = () => canvas.finalizeGhostPlacement(true)
      const announcements: boolean[] = []
      canvas.canvas.addEventListener(
        'litegraph:ghost-placement',
        ({
          detail
        }: CustomEvent<LGraphCanvasEventMap['litegraph:ghost-placement']>) =>
          announcements.push(detail.active),
        { signal: listeners.signal }
      )
      canvas.canvas.addEventListener(event, cancel, {
        once: true,
        signal: listeners.signal
      })

      canvas.startGhostPlacement(node)

      expect(canvas.state.ghostNodeId).toBeNull()
      expect(canvas.isDragging).toBe(false)
      expect(graph.getNodeById(node.id)).toBeNull()
      expect(changes).toEqual(['before-change', 'after-change'])
      expect(announcements.at(-1)).not.toBe(true)

      document.dispatchEvent(new MouseEvent('pointermove'))
      document.documentElement.dispatchEvent(new MouseEvent('pointerleave'))
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      )

      expect(move).not.toHaveBeenCalled()
      expect(windowKeydown).toHaveBeenCalledOnce()
    }
  )

  it('a replacement started during before-change survives the interrupted startup', () => {
    using harness = createGhostLifecycleTestHarness()
    const { canvas, graph, node, changes, listeners } = harness
    const replacement = new LGraphNode('replacement')
    graph.add(replacement)
    function startReplacement() {
      canvas.canvas.removeEventListener('litegraph:canvas', startReplacement)
      canvas.startGhostPlacement(replacement)
    }
    canvas.canvas.addEventListener('litegraph:canvas', startReplacement, {
      signal: listeners.signal
    })

    canvas.startGhostPlacement(node)

    expect(graph.getNodeById(node.id)).toBeNull()
    expect(canvas.state.ghostNodeId).toBe(replacement.id)
    expect(canvas.isDragging).toBe(true)
    expect([...canvas.selectedItems]).toEqual([replacement])

    canvas.finalizeGhostPlacement(true)

    expect(graph.getNodeById(replacement.id)).toBeNull()
    expect(changes).toEqual([
      'before-change',
      'before-change',
      'after-change',
      'after-change'
    ])
  })

  it('a replacement started during cancellation supersedes the interrupted placement request', () => {
    using harness = createGhostLifecycleTestHarness()
    const { canvas, graph, node, changes, listeners } = harness
    const interrupted = new LGraphNode('interrupted')
    const replacement = new LGraphNode('replacement')
    graph.add(interrupted)
    graph.add(replacement)
    canvas.startGhostPlacement(node)
    function startReplacement() {
      canvas.canvas.removeEventListener(
        'litegraph:ghost-placement',
        startReplacement
      )
      canvas.startGhostPlacement(replacement)
    }
    canvas.canvas.addEventListener(
      'litegraph:ghost-placement',
      startReplacement,
      { signal: listeners.signal }
    )

    canvas.startGhostPlacement(interrupted)

    expect(graph.nodes).toEqual([replacement])
    expect(canvas.state.ghostNodeId).toBe(replacement.id)
    expect(canvas.isDragging).toBe(true)

    canvas.finalizeGhostPlacement(true)

    expect(graph.nodes).toEqual([])
    expect(changes).toEqual([
      'before-change',
      'after-change',
      'before-change',
      'after-change'
    ])
  })

  it('a replacement started by an inactive listener retains its placement input', () => {
    using harness = createGhostLifecycleTestHarness()
    const { canvas, graph, node, changes, listeners } = harness
    const replacement = new LGraphNode('replacement')
    graph.add(replacement)
    canvas.startGhostPlacement(node)
    function startReplacement() {
      canvas.canvas.removeEventListener(
        'litegraph:ghost-placement',
        startReplacement
      )
      canvas.startGhostPlacement(replacement)
    }
    canvas.canvas.addEventListener(
      'litegraph:ghost-placement',
      startReplacement,
      { signal: listeners.signal }
    )

    canvas.finalizeGhostPlacement(true)

    expect(graph.getNodeById(node.id)).toBeNull()
    expect(canvas.state.ghostNodeId).toBe(replacement.id)
    expect(canvas.isDragging).toBe(true)
    const move = vi
      .spyOn(canvas, 'processMouseMove')
      .mockImplementation(() => {})
    document.dispatchEvent(new MouseEvent('pointermove'))
    expect(move).toHaveBeenCalledOnce()

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )

    expect(graph.getNodeById(replacement.id)).toBeNull()
    expect(canvas.state.ghostNodeId).toBeNull()
    expect(changes.filter((change) => change === 'before-change')).toHaveLength(
      2
    )
    expect(changes.filter((change) => change === 'after-change')).toHaveLength(
      2
    )
  })
})
