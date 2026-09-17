import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { app as comfyApp } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'

const {
  canvasEl,
  container,
  dragAndScale,
  closeSearchBox,
  processMouseDown,
  processMouseMove
} = vi.hoisted(() => {
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
    closeSearchBox: vi.fn(),
    processMouseDown: vi.fn(),
    processMouseMove: vi.fn()
  }
})

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
    it('recovers when the touch target detached mid-gesture', () => {
      strandTouchesOnDetachedTarget(1)

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
      strandTouchesOnDetachedTarget(2)

      tapDown()
      pointerMove({ isPrimary: true })
      expect(processMouseMove).toHaveBeenCalledOnce()
    })

    it('lets a mouse recover a stuck touch gesture on a hybrid device', () => {
      strandTouchesOnDetachedTarget(2)

      pointerDown({ pointerType: 'mouse', isPrimary: true })
      expect(processMouseDown).toHaveBeenCalledOnce()
    })

    it('re-derives the count from touches rather than accumulating', () => {
      dispatchTouch(canvasEl, 'touchstart', [touchAt(canvasEl)])
      dispatchTouch(canvasEl, 'touchstart', [touchAt(canvasEl)])
      dispatchTouch(canvasEl, 'touchstart', [touchAt(canvasEl)])
      dispatchTouch(canvasEl, 'touchend', [], [touchAt(canvasEl)])

      pointerDown({ isPrimary: true })
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
