import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope } from 'vue'

import { useSelectionGrid } from '@/components/graph/selectionGrid/useSelectionGrid'
import { useTidySession } from '@/components/graph/selectionGrid/useTidySession'

vi.mock(import('@/components/graph/selectionGrid/useSelectionGrid'), {
  spy: true
})

describe('useTidySession', () => {
  const tidyUp = vi.fn(() => 30)
  let frameCallbacks: FrameRequestCallback[]

  beforeEach(() => {
    vi.mocked(useSelectionGrid).mockImplementation(() => ({
      gridNodes: computed(() => []),
      canTidy: computed(() => true),
      measure: () => [],
      moveBoxes: vi.fn(),
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

  it('tidies with the selection’s own gap and shows that gap', () => {
    const session = useTidySession()

    session.start()

    expect(tidyUp).toHaveBeenCalledWith()
    expect(session.gap.value).toBe(30)
  })

  it('previews the latest slider gap once per frame without an undo step', () => {
    const session = useTidySession()
    session.start()
    tidyUp.mockClear()

    session.previewGap(18)
    session.previewGap(24)
    expect(tidyUp).not.toHaveBeenCalled()
    flushFrames()

    expect(tidyUp).toHaveBeenCalledTimes(1)
    expect(tidyUp).toHaveBeenCalledWith({ gap: 24, captureUndo: false })
    expect(session.gap.value).toBe(24)
  })

  it('commits the released gap as one undo step and drops the pending preview', () => {
    const session = useTidySession()
    session.start()
    tidyUp.mockClear()

    session.previewGap(18)
    session.commitGap(20)
    flushFrames()

    expect(tidyUp).toHaveBeenCalledTimes(1)
    expect(tidyUp).toHaveBeenCalledWith({ gap: 20, captureUndo: true })
  })

  it('commits a previewed gap that was never released when the bar closes', () => {
    const session = useTidySession()
    session.start()
    tidyUp.mockClear()

    session.previewGap(18)
    session.finish()
    flushFrames()

    expect(tidyUp).toHaveBeenCalledTimes(1)
    expect(tidyUp).toHaveBeenCalledWith({ gap: 18, captureUndo: true })
  })

  it('closes without moving nodes when the last gap was committed', () => {
    const session = useTidySession()
    session.start()
    session.commitGap(20)
    tidyUp.mockClear()

    session.finish()
    flushFrames()

    expect(tidyUp).not.toHaveBeenCalled()
  })

  it('drops a pending preview when its owner goes away', () => {
    const scope = effectScope()
    const session = scope.run(() => useTidySession())
    if (!session) throw new Error('the session did not start in its scope')
    session.start()
    tidyUp.mockClear()

    session.previewGap(18)
    scope.stop()
    flushFrames()

    expect(tidyUp).not.toHaveBeenCalled()
  })
})
