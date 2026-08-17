/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

import { CanvasPointer } from '@/lib/litegraph/src/CanvasPointer'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/types/events'

interface PointerEventOptions {
  x: number
  y: number
  timeStamp: number
  buttons?: number
}

function createEvent(
  type: string,
  { x, y, timeStamp, buttons = 1 }: PointerEventOptions
): CanvasPointerEvent {
  const event = new PointerEvent(type, {
    clientX: x,
    clientY: y,
    button: 0,
    buttons,
    pointerId: 1,
    isPrimary: true
  })
  Object.defineProperty(event, 'timeStamp', { value: timeStamp })
  return Object.assign(event, {
    canvasX: x,
    canvasY: y,
    deltaX: 0,
    deltaY: 0,
    safeOffsetX: x,
    safeOffsetY: y
  })
}

type PointerCallback = (upEvent: CanvasPointerEvent) => unknown

function createElement(): Element {
  const element = document.createElement('div')
  element.setPointerCapture = vi.fn<(pointerId: number) => void>()
  element.releasePointerCapture = vi.fn<(pointerId: number) => void>()
  element.hasPointerCapture = vi
    .fn<(pointerId: number) => boolean>()
    .mockReturnValue(false)
  return element
}

describe('CanvasPointer click and drag disambiguation', () => {
  let pointer: CanvasPointer
  let onClick: Mock<PointerCallback>
  let onDoubleClick: Mock<PointerCallback>
  let onDragEnd: Mock<PointerCallback>

  beforeEach(() => {
    pointer = new CanvasPointer(createElement())
    onClick = vi.fn<PointerCallback>()
    onDoubleClick = vi.fn<PointerCallback>()
    onDragEnd = vi.fn<PointerCallback>()
  })

  /**
   * Simulates one press-and-release at ({@link x}, {@link y}), delivering a
   * `pointermove` at {@link moveOffset} pixels after {@link moveDelay} ms.
   */
  function press({
    downAt,
    x = 100,
    y = 100,
    moveDelay,
    moveOffset = 0
  }: {
    downAt: number
    x?: number
    y?: number
    moveDelay?: number
    moveOffset?: number
  }) {
    pointer.down(createEvent('pointerdown', { x, y, timeStamp: downAt }))

    // Matches LGraphCanvas.processMouseDown: callbacks are registered after
    // pointer.down(), which resets any left over from the previous gesture.
    pointer.onClick = onClick
    pointer.onDoubleClick = onDoubleClick
    pointer.onDragEnd = onDragEnd

    if (moveDelay !== undefined) {
      pointer.move(
        createEvent('pointermove', {
          x: x + moveOffset,
          y,
          timeStamp: downAt + moveDelay
        })
      )
    }
    pointer.up(
      createEvent('pointerup', {
        x: x + moveOffset,
        y,
        timeStamp: downAt + (moveDelay ?? 0) + 10,
        buttons: 0
      })
    )
  }

  // Pen, touch and trackpad devices emit pointermove continuously while the
  // pointer is held still, so a click held longer than a frame or two always
  // produces a stationary pointermove.
  it('detects a double click when each press emits a stationary pointermove long after pointerdown', () => {
    press({ downAt: 0, moveDelay: 80 })
    press({ downAt: 150, moveDelay: 80 })

    expect(onDoubleClick).toHaveBeenCalledTimes(1)
  })

  it('treats a press that moves beyond the click drift threshold as a drag', () => {
    press({
      downAt: 0,
      moveDelay: 5,
      moveOffset: CanvasPointer.maxClickDrift * 4
    })

    expect(onDragEnd).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })
})
