import { afterEach, describe, expect, it, vi } from 'vitest'

import { CanvasPointer } from './CanvasPointer'
import type { CanvasPointerEvent } from './types/events'

function pointerEvent(
  type: string,
  overrides: PointerEventInit & { timeStamp?: number } = {}
): CanvasPointerEvent {
  const { timeStamp, ...init } = overrides
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX: 10,
    clientY: 10,
    pointerId: 1,
    pointerType: 'mouse',
    ...init
  }) as CanvasPointerEvent

  if (timeStamp !== undefined) {
    Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  }

  return event
}

describe('CanvasPointer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps mouse timed-drag behavior unchanged', () => {
    const element = document.createElement('div')
    vi.spyOn(element, 'setPointerCapture').mockImplementation(() => {})
    vi.spyOn(element, 'hasPointerCapture').mockReturnValue(false)
    const pointer = new CanvasPointer(element)
    const onDragStart = vi.fn()

    pointer.down(pointerEvent('pointerdown', { timeStamp: 0 }))
    pointer.onDragStart = onDragStart
    pointer.move(pointerEvent('pointermove', { timeStamp: 40 }))

    expect(onDragStart).toHaveBeenCalledOnce()
    expect(pointer.dragStarted).toBe(true)
  })

  it.each(['touch', 'pen'] as const)(
    'does not turn a stationary %s pointer into a drag because of elapsed time',
    (pointerType) => {
      const element = document.createElement('div')
      vi.spyOn(element, 'setPointerCapture').mockImplementation(() => {})
      vi.spyOn(element, 'hasPointerCapture').mockReturnValue(false)
      const pointer = new CanvasPointer(element)
      const onClick = vi.fn()
      const onDragStart = vi.fn()

      pointer.down(pointerEvent('pointerdown', { pointerType, timeStamp: 0 }))
      pointer.onClick = onClick
      pointer.onDragStart = onDragStart
      pointer.move(pointerEvent('pointermove', { pointerType, timeStamp: 80 }))
      const isClick = pointer.up(
        pointerEvent('pointerup', { pointerType, timeStamp: 90 })
      )

      expect(onDragStart).not.toHaveBeenCalled()
      expect(onClick).toHaveBeenCalledOnce()
      expect(isClick).toBe(true)
    }
  )

  it.each(['touch', 'pen'] as const)(
    'still starts a %s drag after moving past click drift',
    (pointerType) => {
      const element = document.createElement('div')
      vi.spyOn(element, 'setPointerCapture').mockImplementation(() => {})
      vi.spyOn(element, 'hasPointerCapture').mockReturnValue(false)
      const pointer = new CanvasPointer(element)
      const onDragStart = vi.fn()

      pointer.down(pointerEvent('pointerdown', { pointerType, timeStamp: 0 }))
      pointer.onDragStart = onDragStart
      pointer.move(
        pointerEvent('pointermove', {
          clientX: 40,
          pointerType,
          timeStamp: 10
        })
      )

      expect(onDragStart).toHaveBeenCalledOnce()
      expect(pointer.dragStarted).toBe(true)
    }
  )
})
