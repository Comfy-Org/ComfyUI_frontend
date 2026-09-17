import { fromPartial } from '@total-typescript/shoehorn'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { app as comfyApp } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'

const { canvasEl, container, processMouseDown, processMouseMove } = vi.hoisted(
  () => {
    const container = document.createElement('div')
    const canvasEl = document.createElement('canvas')
    container.append(canvasEl)
    document.body.append(container)
    return {
      container,
      canvasEl,
      processMouseDown: vi.fn(),
      processMouseMove: vi.fn()
    }
  }
)

vi.mock(import('@/scripts/app'), () => ({
  app: fromPartial<typeof comfyApp>({
    registerExtension: (ext: ComfyExtension) => ext.setup?.(fromPartial({})),
    canvasEl,
    canvas: fromPartial({
      ds: { scale: 1 },
      pointer: { isDown: false },
      setDirty: vi.fn()
    })
  })
}))

beforeAll(async () => {
  LGraphCanvas.prototype.processMouseDown = processMouseDown
  LGraphCanvas.prototype.processMouseMove = processMouseMove
  await import('./simpleTouchSupport')
})

const touchAt = (target: EventTarget, x = 0, y = 0) =>
  fromPartial<Touch>({ clientX: x, clientY: y, target })

function dispatchTouch(
  target: EventTarget,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  touches: Touch[],
  changedTouches: Touch[] = touches
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    touches: { value: touches },
    changedTouches: { value: changedTouches }
  })
  target.dispatchEvent(event)
  return event
}

const pointerDown = (init: PointerEventInit = {}) =>
  LGraphCanvas.prototype.processMouseDown.call(
    fromPartial<LGraphCanvas>({}),
    new PointerEvent('pointerdown', { pointerType: 'touch', ...init })
  )

const pointerMove = (init: PointerEventInit = {}) =>
  LGraphCanvas.prototype.processMouseMove.call(
    fromPartial<LGraphCanvas>({}),
    new PointerEvent('pointermove', { pointerType: 'touch', ...init })
  )

/** Mirrors the real order for touch input: pointerdown precedes touchstart. */
function tapDown(target: EventTarget = canvasEl, isPrimary = true) {
  pointerDown({ isPrimary })
  dispatchTouch(target, 'touchstart', [touchAt(target)])
}

describe('Comfy.SimpleTouchSupport touch state', () => {
  beforeEach(() => {
    processMouseDown.mockClear()
    processMouseMove.mockClear()
    // Settle any state a previous case left behind.
    dispatchTouch(canvasEl, 'touchend', [], [touchAt(canvasEl)])
    pointerDown({ isPrimary: true })
    processMouseDown.mockClear()
  })

  it('forwards a single-finger tap to the canvas', () => {
    tapDown()
    expect(processMouseDown).toHaveBeenCalledOnce()
  })

  it('does not let a second finger start a drag', () => {
    tapDown()
    processMouseDown.mockClear()

    pointerDown({ isPrimary: false })
    expect(processMouseDown).not.toHaveBeenCalled()
  })

  it('recovers when a touchend is lost because its target was detached', () => {
    // A pinch tears down transient UI (context menus, the search box) and vue
    // nodes unmount as the graph zooms, so a finger can be resting on an
    // element that no longer exists when it lifts. FE-2435.
    const doomed = document.createElement('div')
    container.append(doomed)
    dispatchTouch(doomed, 'touchstart', [touchAt(doomed)])
    doomed.remove()
    dispatchTouch(doomed, 'touchend', [], [touchAt(doomed)])

    tapDown()
    expect(processMouseDown).toHaveBeenCalledOnce()
  })

  it('recovers when a descendant stops touchend from propagating', () => {
    const child = document.createElement('div')
    child.addEventListener('touchend', (e) => e.stopPropagation())
    container.append(child)

    dispatchTouch(child, 'touchstart', [touchAt(child)])
    dispatchTouch(child, 'touchend', [], [touchAt(child)])
    child.remove()

    tapDown()
    expect(processMouseDown).toHaveBeenCalledOnce()
  })

  it('keeps pointermove alive after a lost two-finger touchend', () => {
    const doomed = document.createElement('div')
    container.append(doomed)
    dispatchTouch(doomed, 'touchstart', [touchAt(doomed), touchAt(doomed, 50)])
    doomed.remove()
    dispatchTouch(doomed, 'touchend', [], [touchAt(doomed)])

    tapDown()
    pointerMove({ isPrimary: true })
    expect(processMouseMove).toHaveBeenCalledOnce()
  })

  it('blocks the canvas while two fingers are actually down', () => {
    dispatchTouch(canvasEl, 'touchstart', [touchAt(canvasEl)])
    dispatchTouch(canvasEl, 'touchstart', [
      touchAt(canvasEl),
      touchAt(canvasEl, 50)
    ])

    pointerDown({ isPrimary: false })
    expect(processMouseDown).not.toHaveBeenCalled()
  })

  it('re-derives the count from touches rather than accumulating', () => {
    // Three touchstarts reporting one finger must leave the count at one, not
    // three, so the canvas is usable again as soon as that finger lifts.
    for (let i = 0; i < 3; i++) {
      dispatchTouch(canvasEl, 'touchstart', [touchAt(canvasEl)])
    }
    dispatchTouch(canvasEl, 'touchend', [], [touchAt(canvasEl)])

    pointerDown({ isPrimary: true })
    expect(processMouseDown).toHaveBeenCalledOnce()
  })
})
