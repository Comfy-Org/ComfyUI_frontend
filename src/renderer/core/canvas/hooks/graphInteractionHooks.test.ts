import { afterEach, describe, expect, it, vi } from 'vitest'

import { graphInteractionHooks } from './graphInteractionHooks'
import type {
  NodeDragEndEvent,
  NodeDragMoveEvent
} from './graphInteractionHooks'

const sampleMove: NodeDragMoveEvent = {
  nodeId: 'node-1',
  canvasPos: { x: 10, y: 20 },
  pointerEvent: new PointerEvent('pointermove'),
  selectionSize: 1
}

const sampleEnd: NodeDragEndEvent = {
  nodeId: 'node-1',
  canvasPos: { x: 10, y: 20 },
  pointerEvent: new PointerEvent('pointerup'),
  selectionSize: 1
}

describe('graphInteractionHooks', () => {
  afterEach(() => {
    graphInteractionHooks.clear()
  })

  it('delivers events to subscribed listeners', () => {
    const listener = vi.fn()
    graphInteractionHooks.on('nodeDragMove', listener)

    graphInteractionHooks.emit('nodeDragMove', sampleMove)

    expect(listener).toHaveBeenCalledWith(sampleMove)
  })

  it('returns an unsubscribe function that stops delivery', () => {
    const listener = vi.fn()
    const unsubscribe = graphInteractionHooks.on('nodeDragMove', listener)

    unsubscribe()
    graphInteractionHooks.emit('nodeDragMove', sampleMove)

    expect(listener).not.toHaveBeenCalled()
  })

  it('isolates listeners across event types', () => {
    const moveListener = vi.fn()
    const endListener = vi.fn()
    graphInteractionHooks.on('nodeDragMove', moveListener)
    graphInteractionHooks.on('nodeDragEnd', endListener)

    graphInteractionHooks.emit('nodeDragMove', sampleMove)

    expect(moveListener).toHaveBeenCalledTimes(1)
    expect(endListener).not.toHaveBeenCalled()
  })

  it('continues delivery after a listener throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing = vi.fn(() => {
      throw new Error('listener boom')
    })
    const succeeding = vi.fn()

    graphInteractionHooks.on('nodeDragMove', failing)
    graphInteractionHooks.on('nodeDragMove', succeeding)

    graphInteractionHooks.emit('nodeDragMove', sampleMove)

    expect(failing).toHaveBeenCalledTimes(1)
    expect(succeeding).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalledTimes(1)

    consoleSpy.mockRestore()
  })

  it('clear() removes all listeners across event types', () => {
    const moveListener = vi.fn()
    const endListener = vi.fn()
    graphInteractionHooks.on('nodeDragMove', moveListener)
    graphInteractionHooks.on('nodeDragEnd', endListener)

    graphInteractionHooks.clear()

    graphInteractionHooks.emit('nodeDragMove', sampleMove)
    graphInteractionHooks.emit('nodeDragEnd', sampleEnd)

    expect(moveListener).not.toHaveBeenCalled()
    expect(endListener).not.toHaveBeenCalled()
  })
})
