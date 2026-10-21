import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, shallowRef } from 'vue'

import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import { useTidySession } from '@/components/graph/selectionGrid/useTidySession'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'

vi.mock(import('@/components/graph/selectionGrid/useSelectionGrid'), {
  spy: true
})

describe('useTidySession', () => {
  const a = new LGraphNode('A')
  const b = new LGraphNode('B')
  const tidyUp = vi.fn<ReturnType<typeof useSelectionGrid>['tidyUp']>(() => 30)
  const recordUndoStep = vi.fn()
  const selectedNodes = shallowRef<LGraphNode[]>([])
  let frameCallbacks: FrameRequestCallback[]

  beforeEach(() => {
    selectedNodes.value = [a, b]
    vi.mocked(useSelectionGrid).mockImplementation(() => ({
      gridNodes: computed(() => selectedNodes.value),
      canTidy: computed(() => true),
      measure: () => [],
      placeBoxes: vi.fn(),
      moveBoxes: vi.fn(),
      recordUndoStep,
      tidyUp
    }))
    frameCallbacks = []
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      frameCallbacks.push(cb)
      return frameCallbacks.length
    })
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
      frameCallbacks[id - 1] = () => {}
    })
  })

  const flushFrames = () => {
    const callbacks = frameCallbacks
    frameCallbacks = []
    callbacks.forEach((cb) => cb(performance.now()))
  }

  const startedSession = () => {
    const session = useTidySession()
    session.start()
    tidyUp.mockClear()
    return session
  }

  it('tidies the selected nodes with their own gap and shows that gap', () => {
    const session = useTidySession()

    session.start()

    expect(tidyUp).toHaveBeenCalledWith([a, b])
    expect(session.gap.value).toBe(30)
  })

  it('previews the latest slider gap once per frame without an undo step', () => {
    const session = startedSession()

    session.previewGap(18)
    session.previewGap(24)
    expect(tidyUp).not.toHaveBeenCalled()
    flushFrames()

    expect(tidyUp).toHaveBeenCalledTimes(1)
    expect(tidyUp).toHaveBeenCalledWith([a, b], {
      gap: 24,
      captureUndo: false
    })
    expect(recordUndoStep).not.toHaveBeenCalled()
    expect(session.gap.value).toBe(24)
  })

  it('commits the released gap as one undo step and drops the pending preview', () => {
    const session = startedSession()

    session.previewGap(18)
    session.commitGap(20)
    flushFrames()

    expect(tidyUp).toHaveBeenCalledTimes(1)
    expect(tidyUp).toHaveBeenCalledWith([a, b], {
      gap: 20,
      captureUndo: false
    })
    expect(recordUndoStep).toHaveBeenCalledTimes(1)
  })

  it('keeps tidying the nodes it started with after the selection changes', () => {
    const session = startedSession()

    selectedNodes.value = [new LGraphNode('C'), new LGraphNode('D')]
    session.previewGap(18)
    flushFrames()
    session.finish()

    expect(tidyUp.mock.calls.map(([nodes]) => nodes)).toEqual([
      [a, b],
      [a, b]
    ])
  })

  it('commits a previewed gap that was never released when the bar closes', () => {
    const session = startedSession()

    session.previewGap(18)
    session.finish()
    flushFrames()

    expect(tidyUp).toHaveBeenCalledTimes(1)
    expect(tidyUp).toHaveBeenCalledWith([a, b], {
      gap: 18,
      captureUndo: false
    })
    expect(recordUndoStep).toHaveBeenCalledTimes(1)
  })

  it('puts the committed gap back when the slider returns to it before its frame runs', () => {
    const session = startedSession()

    session.previewGap(18)
    flushFrames()
    session.previewGap(30)
    session.finish()
    flushFrames()

    expect(tidyUp).toHaveBeenLastCalledWith([a, b], {
      gap: 30,
      captureUndo: false
    })
    expect(recordUndoStep).toHaveBeenCalledTimes(1)
  })

  it('records a slide that ends on the gap it started from', () => {
    const session = startedSession()

    session.previewGap(18)
    flushFrames()
    session.previewGap(30)
    flushFrames()
    session.finish()

    expect(tidyUp).toHaveBeenLastCalledWith([a, b], {
      gap: 30,
      captureUndo: false
    })
    expect(recordUndoStep).toHaveBeenCalledTimes(1)
  })

  it('closes without moving nodes when the last gap was committed', () => {
    const session = startedSession()
    session.commitGap(20)
    tidyUp.mockClear()
    recordUndoStep.mockClear()

    session.finish()
    flushFrames()

    expect(tidyUp).not.toHaveBeenCalled()
    expect(recordUndoStep).not.toHaveBeenCalled()
  })

  it('shows a gap the handles laid out and closes without moving nodes', () => {
    const session = startedSession()
    session.previewGap(18)

    session.adoptGap(60)
    session.finish()
    flushFrames()

    expect(session.gap.value).toBe(60)
    expect(tidyUp).not.toHaveBeenCalled()
    expect(recordUndoStep).not.toHaveBeenCalled()
  })

  it('commits a previewed gap when its owner goes away', () => {
    const scope = effectScope()
    const session = scope.run(() => useTidySession())
    if (!session) throw new Error('the session did not start in its scope')
    session.start()
    tidyUp.mockClear()

    session.previewGap(18)
    scope.stop()
    flushFrames()

    expect(tidyUp).toHaveBeenCalledTimes(1)
    expect(tidyUp).toHaveBeenCalledWith([a, b], {
      gap: 18,
      captureUndo: false
    })
    expect(recordUndoStep).toHaveBeenCalledTimes(1)
  })
})
