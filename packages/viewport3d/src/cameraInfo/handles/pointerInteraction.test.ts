import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PointerInteraction } from './pointerInteraction'
import type { PointerInteractionHost } from './pointerInteraction'

type Handle = 'yaw' | 'pitch'

const frames: FrameRequestCallback[] = []

function runFrame(): void {
  for (const cb of frames.splice(0)) cb(0)
}

function dispatchPointer(
  target: HTMLElement,
  type: string,
  clientX: number,
  clientY: number,
  pointerId = 1
): void {
  const event = new MouseEvent(type, { clientX, clientY, button: 0 })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  target.dispatchEvent(event)
}

function dispatchWheel(target: HTMLElement, deltaY: number): WheelEvent {
  const event = new WheelEvent('wheel', { cancelable: true })
  Object.defineProperty(event, 'deltaY', { value: deltaY })
  target.dispatchEvent(event)
  return event
}

function makeHost(overrides: Partial<PointerInteractionHost<Handle>> = {}) {
  const canvas = document.createElement('canvas')
  canvas.setPointerCapture = vi.fn()
  canvas.releasePointerCapture = vi.fn()
  canvas.hasPointerCapture = vi.fn(() => true)
  const host: PointerInteractionHost<Handle> = {
    canvas,
    pickHandle: vi.fn(() => null),
    dragHandle: vi.fn(),
    hoverChanged: vi.fn(),
    handleDragChanged: vi.fn(),
    freeDragEnabled: vi.fn(() => false),
    freeDrag: vi.fn(),
    wheelEnabled: vi.fn(() => false),
    wheel: vi.fn(),
    idleCursor: vi.fn(() => ''),
    ...overrides
  }
  return host
}

beforeEach(() => {
  frames.length = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames.length = 0
  })
})

describe('PointerInteraction', () => {
  it('drags a picked handle, disabling the host while dragging', () => {
    const host = makeHost({ pickHandle: vi.fn((): Handle | null => 'yaw') })
    const interaction = new PointerInteraction(host)
    interaction.attach()

    dispatchPointer(host.canvas, 'pointerdown', 10, 10)
    expect(host.handleDragChanged).toHaveBeenCalledWith(true)
    expect(host.canvas.setPointerCapture).toHaveBeenCalledWith(1)
    expect(host.canvas.style.cursor).toBe('grabbing')

    dispatchPointer(host.canvas, 'pointermove', 30, 10)
    runFrame()
    expect(host.dragHandle).toHaveBeenCalledWith(
      'yaw',
      expect.objectContaining({ clientX: 30 })
    )

    dispatchPointer(host.canvas, 'pointerup', 30, 10)
    expect(host.handleDragChanged).toHaveBeenLastCalledWith(false)
    expect(host.canvas.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('ignores moves from a different pointer during a drag', () => {
    const host = makeHost({ pickHandle: vi.fn((): Handle | null => 'yaw') })
    new PointerInteraction(host).attach()

    dispatchPointer(host.canvas, 'pointerdown', 10, 10)
    dispatchPointer(host.canvas, 'pointermove', 30, 10, 2)
    runFrame()

    expect(host.dragHandle).not.toHaveBeenCalled()
  })

  it('reports hover changes only when the picked handle changes', () => {
    const pickHandle = vi
      .fn<(p: { clientX: number }) => Handle | null>()
      .mockReturnValueOnce('pitch')
      .mockReturnValueOnce('pitch')
      .mockReturnValueOnce(null)
    const host = makeHost({
      pickHandle,
      idleCursor: vi.fn(() => 'grab')
    })
    const interaction = new PointerInteraction(host)
    interaction.attach()

    dispatchPointer(host.canvas, 'pointermove', 5, 5)
    runFrame()
    dispatchPointer(host.canvas, 'pointermove', 6, 6)
    runFrame()
    expect(host.hoverChanged).toHaveBeenCalledTimes(1)
    expect(interaction.hoveredHandle).toBe('pitch')
    expect(host.canvas.style.cursor).toBe('grab')

    host.canvas.dispatchEvent(new MouseEvent('pointerleave'))
    expect(host.hoverChanged).toHaveBeenLastCalledWith(null)
  })

  it('turns free drags into rotation deltas when the host allows them', () => {
    const host = makeHost({ freeDragEnabled: vi.fn(() => true) })
    new PointerInteraction(host).attach()

    dispatchPointer(host.canvas, 'pointerdown', 100, 100)
    dispatchPointer(host.canvas, 'pointermove', 110, 105)
    dispatchPointer(host.canvas, 'pointermove', 130, 105)
    runFrame()

    expect(host.freeDrag).toHaveBeenCalledOnce()
    expect(host.freeDrag).toHaveBeenCalledWith(30, 5)
    expect(host.handleDragChanged).not.toHaveBeenCalled()
  })

  it('does nothing on empty space when free drag is disabled', () => {
    const host = makeHost()
    new PointerInteraction(host).attach()

    dispatchPointer(host.canvas, 'pointerdown', 100, 100)
    dispatchPointer(host.canvas, 'pointermove', 130, 100)
    runFrame()

    expect(host.canvas.setPointerCapture).not.toHaveBeenCalled()
    expect(host.freeDrag).not.toHaveBeenCalled()
  })

  it('accumulates wheel deltas per frame only when enabled', () => {
    const host = makeHost({ wheelEnabled: vi.fn(() => true) })
    new PointerInteraction(host).attach()

    const first = dispatchWheel(host.canvas, 40)
    dispatchWheel(host.canvas, 60)
    runFrame()

    expect(first.defaultPrevented).toBe(true)
    expect(host.wheel).toHaveBeenCalledOnce()
    expect(host.wheel).toHaveBeenCalledWith(100)

    vi.mocked(host.wheelEnabled).mockReturnValue(false)
    const ignored = dispatchWheel(host.canvas, 10)
    runFrame()
    expect(ignored.defaultPrevented).toBe(false)
    expect(host.wheel).toHaveBeenCalledOnce()
  })

  it('cancel clears pending input, releases the handle drag and resets the cursor', () => {
    const host = makeHost({ pickHandle: vi.fn((): Handle | null => 'yaw') })
    const interaction = new PointerInteraction(host)
    interaction.attach()
    dispatchPointer(host.canvas, 'pointerdown', 10, 10)
    dispatchPointer(host.canvas, 'pointermove', 30, 10)

    interaction.cancel()
    runFrame()

    expect(host.dragHandle).not.toHaveBeenCalled()
    expect(host.handleDragChanged).toHaveBeenLastCalledWith(false)
    expect(host.hoverChanged).toHaveBeenLastCalledWith(null)
    expect(host.canvas.style.cursor).toBe('')
  })

  it('stops listening after detach', () => {
    const host = makeHost({ pickHandle: vi.fn((): Handle | null => 'yaw') })
    const interaction = new PointerInteraction(host)
    interaction.attach()
    interaction.detach()

    dispatchPointer(host.canvas, 'pointerdown', 10, 10)

    expect(host.pickHandle).not.toHaveBeenCalled()
  })
})
