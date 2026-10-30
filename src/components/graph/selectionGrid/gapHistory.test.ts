import { fromPartial } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, markRaw, nextTick, ref } from 'vue'

import { computeGapBars, detectSelectionGrid } from './selectionGridLayout'
import { useGapDragSession } from './useGapDragSession'
import { useSelectionGrid } from './useSelectionGrid'
import { useTidySession } from './useTidySession'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import {
  LGraphCanvas,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { createTestSubgraphData } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { zComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { ChangeTracker } from '@/scripts/changeTracker'
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'

vi.mock(import('@vueuse/router'), () => ({ useRouteHash: () => ref('') }))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/scripts/api'))

describe('gap gestures with workflow history', () => {
  let graph: LGraph
  let a: LGraphNode
  let b: LGraphNode
  let tracker: ChangeTracker
  let events: EventTarget
  let session: ReturnType<typeof useGapDragSession>

  const firstBar = () => {
    const bar = computeGapBars(
      detectSelectionGrid(useSelectionGrid().measure())
    )[0]
    assert.exists(bar)
    return bar
  }

  beforeEach(() => {
    graph = app.rootGraph
    a = new LGraphNode('A')
    b = new LGraphNode('B')
    graph.add(a)
    graph.add(b)
    a.pos = [0, 0]
    b.pos = [230, 0]
    a.setSize([200, 100])
    b.setSize([150, 100])
    app.canvas.graph = graph
    const canvasStore = useCanvasStore()
    canvasStore.canvas = fromPartial<LGraphCanvas>({
      graph,
      setDirty: vi.fn(),
      deselect: vi.fn()
    })
    canvasStore.currentGraph = graph
    setCanvasSelection([a, b])
    const workflow = fromPartial<
      ConstructorParameters<typeof ChangeTracker>[0]
    >({ path: '/test/gaps.json' })
    tracker = markRaw(
      new ChangeTracker(workflow, zComfyWorkflow.parse(graph.serialize()))
    )
    useWorkflowStore().activeWorkflow = fromPartial({ changeTracker: tracker })
    tracker.captureCanvasState()
    tracker.undoQueue.length = 0
    useQueueSettingsStore().mode = 'instant-idle'
    app.ui.autoQueueEnabled = false
    events = new EventTarget()
    const documentEvents = new EventTarget()
    vi.spyOn(window, 'addEventListener').mockImplementation(
      (type, listener, options) =>
        events.addEventListener(type, listener, options)
    )
    vi.spyOn(document, 'addEventListener').mockImplementation(
      (type, listener, options) =>
        documentEvents.addEventListener(type, listener, options)
    )
    vi.spyOn(LGraphCanvas.prototype, 'processMouseUp')
    vi.spyOn(LGraphCanvas.prototype, 'prompt')
    vi.spyOn(LiteGraph.ContextMenu.prototype, 'close')
    ChangeTracker.init()
    const scope = effectScope()
    const scopedSession = scope.run(useGapDragSession)
    assert.exists(scopedSession)
    session = scopedSession
    return () => scope.stop()
  })

  it.for(['instant-idle', 'change'] as const)(
    'records a held arrow as one undo step in %s queue mode',
    async (mode) => {
      useQueueSettingsStore().mode = mode
      const bar = firstBar()
      events.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      session.nudge(bar, 1)
      vi.advanceTimersToNextFrame()
      await Promise.resolve()
      session.nudge(bar, 1)
      session.nudge(bar, 1)
      session.commitNudges()

      expect([...b.pos]).toEqual([233, 0])
      expect(tracker.undoQueue.map((state) => state.nodes[1].pos)).toEqual([
        [230, 0]
      ])
    }
  )

  it('does not adopt a preview when an earlier capture finishes squashing', async () => {
    a.pos = [1, 0]
    tracker.captureCanvasState()
    session.start(firstBar())
    session.preview(10)
    vi.advanceTimersToNextFrame()
    await vi.advanceTimersByTimeAsync(50)
    session.preview(20)
    session.commit()

    expect([...b.pos]).toEqual([250, 0])
    expect(tracker.undoQueue.at(-1)?.nodes[1].pos).toEqual([230, 0])
  })

  it.for([0, 16])(
    'cancels without a history entry after %i milliseconds',
    (elapsed) => {
      session.start(firstBar())
      session.preview(10)
      vi.advanceTimersByTime(elapsed)
      events.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }))
      events.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }))
      session.cancel()
      vi.advanceTimersToNextFrame()
      tracker.captureCanvasState()

      expect([...b.pos]).toEqual([230, 0])
      expect(tracker.undoQueue).toEqual([])
    }
  )

  it('restores raw positions even when the drawn bounds change during the drag', () => {
    session.start(firstBar())
    session.preview(10)
    vi.advanceTimersToNextFrame()
    b.onBounding = (bounds) => {
      bounds[0] -= 17
      bounds[1] -= 9
    }
    session.cancel()

    expect([...b.pos]).toEqual([230, 0])
  })

  it('cancels on navigation without moving the destination graph', async () => {
    const destination = graph.createSubgraph(createTestSubgraphData())
    tracker.captureCanvasState()
    tracker.undoQueue.length = 0
    session.start(firstBar())
    session.preview(10)
    vi.advanceTimersToNextFrame()
    const canvas = useCanvasStore().canvas
    assert.exists(canvas)
    canvas.graph = destination
    useCanvasStore().currentGraph = destination
    await nextTick()
    tracker.captureCanvasState()

    expect([...b.pos]).toEqual([230, 0])
    expect(session.drag.value).toBeNull()
    expect(tracker.undoQueue).toEqual([])
  })

  it('settles the outgoing workflow before its graph is replaced', () => {
    session.start(firstBar())
    session.preview(10)
    vi.advanceTimersToNextFrame()
    tracker.deactivate()

    expect([...b.pos]).toEqual([230, 0])
    expect(tracker.activeState.nodes[1].pos).toEqual([230, 0])
    expect(tracker.undoQueue).toEqual([])
    expect(tracker.changeCount).toBe(0)
  })

  it('commits slider previews once before a handle takes ownership', async () => {
    const scope = effectScope()
    const tidy = scope.run(useTidySession)
    assert.exists(tidy)
    tidy.start()
    tracker.undoQueue.length = 0
    tidy.previewGap(35)
    vi.advanceTimersToNextFrame()
    await vi.advanceTimersByTimeAsync(50)
    tidy.previewGap(40)
    tidy.handles.start(firstBar())
    tidy.handles.preview(10)
    vi.advanceTimersToNextFrame()
    tidy.handles.cancel()
    scope.stop()

    expect([...b.pos]).toEqual([240, 0])
    expect(tracker.undoQueue.map((state) => state.nodes[1].pos)).toEqual([
      [230, 0]
    ])
    expect(tracker.activeState.nodes[1].pos).toEqual([240, 0])
  })

  it('does not restore detached nodes over replacements with the same IDs', () => {
    session.start(firstBar())
    session.preview(10)
    vi.advanceTimersToNextFrame()
    const id = b.id
    graph.clear()
    const replacement = new LGraphNode('Replacement')
    replacement.id = id
    graph.add(replacement)
    replacement.pos = [700, 100]
    session.cancel()

    expect([...replacement.pos]).toEqual([700, 100])
  })
})
