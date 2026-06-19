import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as ArrangeNodesModule from '@/composables/graph/useArrangeNodes'
import { useArrangeSession } from '@/composables/graph/useArrangeSession'

const mockArrangeNodes = vi.fn()

vi.mock('@/composables/graph/useArrangeNodes', async () => {
  const actual = await vi.importActual<typeof ArrangeNodesModule>(
    '@/composables/graph/useArrangeNodes'
  )
  return {
    ...actual,
    useArrangeNodes: () => ({ arrangeNodes: mockArrangeNodes })
  }
})

describe('useArrangeSession', () => {
  let frameCallbacks: Array<FrameRequestCallback>
  let nextHandle: number

  beforeEach(() => {
    mockArrangeNodes.mockReset()
    frameCallbacks = []
    nextHandle = 1
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
      (cb: FrameRequestCallback) => {
        frameCallbacks.push(cb)
        return nextHandle++
      }
    )
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
      frameCallbacks[id - 1] = () => {}
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const flushFrames = () => {
    const callbacks = frameCallbacks
    frameCallbacks = []
    callbacks.forEach((cb) => cb(performance.now()))
  }

  it('start() applies layout immediately and captures undo', () => {
    const session = useArrangeSession()
    session.start('vertical')

    expect(mockArrangeNodes).toHaveBeenCalledTimes(1)
    expect(mockArrangeNodes).toHaveBeenCalledWith('vertical', {
      gap: 12,
      captureUndo: true
    })
    expect(session.activeLayout.value).toBe('vertical')
    expect(session.gap.value).toBe(12)
  })

  it('previewGap() throttles repeated calls into a single frame', () => {
    const session = useArrangeSession()
    session.start('grid')
    mockArrangeNodes.mockClear()

    session.previewGap(20)
    session.previewGap(30)
    session.previewGap(40)

    expect(mockArrangeNodes).not.toHaveBeenCalled()
    flushFrames()

    expect(mockArrangeNodes).toHaveBeenCalledTimes(1)
    expect(mockArrangeNodes).toHaveBeenCalledWith('grid', {
      gap: 40,
      captureUndo: false
    })
  })

  it('previewGap() is a no-op outside an active session', () => {
    const session = useArrangeSession()
    session.previewGap(20)
    flushFrames()
    expect(mockArrangeNodes).not.toHaveBeenCalled()
  })

  it('commitGap() cancels any pending preview frame', () => {
    const session = useArrangeSession()
    session.start('horizontal')
    mockArrangeNodes.mockClear()

    session.previewGap(25)
    session.commitGap(36)
    flushFrames()

    expect(mockArrangeNodes).toHaveBeenCalledTimes(1)
    expect(mockArrangeNodes).toHaveBeenCalledWith('horizontal', {
      gap: 36,
      captureUndo: true
    })
  })

  it('reset() ends the session and prevents pending frames from arranging', () => {
    const session = useArrangeSession()
    session.start('vertical')
    mockArrangeNodes.mockClear()

    session.previewGap(40)
    session.reset()
    flushFrames()

    expect(mockArrangeNodes).not.toHaveBeenCalled()
    expect(session.activeLayout.value).toBeNull()
    expect(session.gap.value).toBe(12)
  })
})
