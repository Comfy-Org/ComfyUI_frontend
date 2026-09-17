import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { app as comfyApp } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'

const { canvasEl, container, dragAndScale, closeSearchBox } = vi.hoisted(() => {
  const container = document.createElement('div')
  const canvasEl = document.createElement('canvas')
  container.append(canvasEl)
  return {
    container,
    canvasEl,
    dragAndScale: {
      scale: 1,
      offset: [0, 0] as [number, number],
      min_scale: 0.1,
      max_scale: 10
    },
    closeSearchBox: vi.fn()
  }
})

const processMouseDown = vi.fn()
const processMouseMove = vi.fn()

vi.mock(import('@/scripts/app'), () => ({
  app: fromPartial<typeof comfyApp>({
    registerExtension: (ext: ComfyExtension) => ext.setup?.(fromPartial({})),
    canvasEl,
    canvas: fromPartial({
      ds: dragAndScale,
      pointer: { isDown: false },
      setDirty: vi.fn(),
      search_box: { close: closeSearchBox }
    })
  })
}))

LGraphCanvas.prototype.processMouseDown = processMouseDown
LGraphCanvas.prototype.processMouseMove = processMouseMove

await import('./simpleTouchSupport')

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
}

const pointerDown = (init: PointerEventInit) =>
  LGraphCanvas.prototype.processMouseDown.call(
    fromPartial<LGraphCanvas>({}),
    new PointerEvent('pointerdown', { pointerType: 'touch', ...init })
  )

const pointerMove = (init: PointerEventInit) =>
  LGraphCanvas.prototype.processMouseMove.call(
    fromPartial<LGraphCanvas>({}),
    new PointerEvent('pointermove', { pointerType: 'touch', ...init })
  )

/** Mirrors the real order for touch input: pointerdown precedes touchstart. */
function tapDown(target: EventTarget = canvasEl) {
  pointerDown({ isPrimary: true })
  dispatchTouch(target, 'touchstart', [touchAt(target)])
}

function strandTouchesOnDetachedTarget(count: number) {
  const doomed = document.createElement('div')
  container.append(doomed)
  const touches = Array.from({ length: count }, (_, i) =>
    touchAt(doomed, i * 50)
  )
  dispatchTouch(doomed, 'touchstart', touches)
  doomed.remove()
  dispatchTouch(doomed, 'touchend', [], touches)
}

/**
 * Probes the guards without going through a primary pointerdown, which would
 * itself clear the state these cases are asserting on.
 */
const tapReachesCanvas = () => {
  processMouseDown.mockClear()
  pointerDown({ isPrimary: false })
  return processMouseDown.mock.calls.length === 1
}

const dragReachesCanvas = () => {
  processMouseMove.mockClear()
  pointerMove({ isPrimary: true })
  return processMouseMove.mock.calls.length === 1
}

describe('Comfy.SimpleTouchSupport touch state', () => {
  beforeEach(() => {
    document.body.append(container)
    dragAndScale.scale = 1
    dragAndScale.offset = [0, 0]
    // Reset through the visibilitychange listener rather than through touch or
    // pointer events, so the fixture does not depend on the behaviour under
    // test and stays valid against pre-fix revisions.
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    hidden.mockRestore()
  })

  describe('preserved behaviour', () => {
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

    it('blocks the canvas while two fingers are down', () => {
      dispatchTouch(canvasEl, 'touchstart', [touchAt(canvasEl)])
      dispatchTouch(canvasEl, 'touchstart', [
        touchAt(canvasEl),
        touchAt(canvasEl, 50)
      ])

      pointerDown({ isPrimary: false })
      expect(processMouseDown).not.toHaveBeenCalled()
    })
  })

  describe('recovery from a touchend that never arrives (FE-2435)', () => {
    it('sees a touchend a descendant stopped from propagating', () => {
      const child = document.createElement('div')
      child.addEventListener('touchend', (e) => e.stopPropagation())
      container.append(child)

      dispatchTouch(child, 'touchstart', [touchAt(child)])
      dispatchTouch(child, 'touchend', [], [touchAt(child)])
      child.remove()

      expect(tapReachesCanvas()).toBe(true)
    })

    it('does not go negative when touchcancel precedes the last touchend', () => {
      const [first, second] = [touchAt(canvasEl), touchAt(canvasEl, 50)]
      dispatchTouch(canvasEl, 'touchstart', [first, second])
      dispatchTouch(canvasEl, 'touchcancel', [first], [second])
      dispatchTouch(canvasEl, 'touchend', [], [first])

      expect(tapReachesCanvas()).toBe(true)
    })

    it('re-derives the count rather than accumulating past a lost touchend', () => {
      strandTouchesOnDetachedTarget(2)
      dispatchTouch(canvasEl, 'touchmove', [touchAt(canvasEl)])

      expect(dragReachesCanvas()).toBe(true)
    })

    it('a fresh tap revives a canvas left stuck by a lost touchend', () => {
      strandTouchesOnDetachedTarget(1)

      tapDown()
      expect(processMouseDown).toHaveBeenCalledOnce()
    })

    it('lets a mouse recover a stuck touch gesture on a hybrid device', () => {
      strandTouchesOnDetachedTarget(2)

      pointerDown({ pointerType: 'mouse', isPrimary: true })
      expect(processMouseDown).toHaveBeenCalledOnce()
    })
  })

  it('closes transient UI once per pinch rather than on every frame', () => {
    const closeAllContextMenus = vi
      .spyOn(LiteGraph, 'closeAllContextMenus')
      .mockImplementation(() => {})

    dispatchTouch(canvasEl, 'touchstart', [touchAt(canvasEl)])
    dispatchTouch(canvasEl, 'touchstart', [
      touchAt(canvasEl),
      touchAt(canvasEl, 100)
    ])
    for (const gap of [90, 80, 70]) {
      dispatchTouch(canvasEl, 'touchmove', [
        touchAt(canvasEl),
        touchAt(canvasEl, gap)
      ])
    }

    expect(closeAllContextMenus).toHaveBeenCalledOnce()
    expect(closeSearchBox).toHaveBeenCalledOnce()
  })
})
