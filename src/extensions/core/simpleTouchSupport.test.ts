import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { shallowRef } from 'vue'

import type { DragAndScale } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { app as comfyApp } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'

type Viewport = Pick<
  DragAndScale,
  'scale' | 'offset' | 'min_scale' | 'max_scale'
>

const { canvasEl, container, canvasAvailability, ds } = vi.hoisted(() => {
  const container = document.createElement('div')
  const canvasEl = document.createElement('canvas')
  container.append(canvasEl)
  const ds: Viewport = {
    scale: 1,
    offset: [0, 0],
    min_scale: 0.1,
    max_scale: 10
  }
  return { container, canvasEl, canvasAvailability: { missing: false }, ds }
})

const processMouseDown = vi.fn()

vi.mock(import('@/scripts/app'), () => {
  const canvas = fromPartial<LGraphCanvas>({
    ds,
    pointer: { isDown: false },
    setDirty: vi.fn()
  })
  return {
    app: fromPartial<typeof comfyApp>({
      registerExtension: (ext: ComfyExtension) => ext.setup?.(fromPartial({})),
      canvasEl,
      canvasElRef: shallowRef(canvasEl),
      get canvasOrUndefined() {
        return canvasAvailability.missing ? undefined : canvas
      }
    })
  }
})

LGraphCanvas.prototype.processMouseDown = processMouseDown

await import('./simpleTouchSupport')

let nextTouchId = 0

function touchAt(target: EventTarget, x = 0, y = 0) {
  return new Touch({
    identifier: nextTouchId++,
    target,
    clientX: x,
    clientY: y
  })
}

function dispatchTouch(
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  touches: Touch[],
  changedTouches: Touch[] = touches
) {
  canvasEl.dispatchEvent(
    new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches,
      changedTouches
    })
  )
}

function pressPointer(init: PointerEventInit) {
  const canvas = fromPartial<LGraphCanvas>({ pointer: { isDown: true } })
  LGraphCanvas.prototype.processMouseDown.call(
    canvas,
    new PointerEvent('pointerdown', { pointerType: 'touch', ...init })
  )
  return canvas
}

function withoutCanvas() {
  canvasAvailability.missing = true
  onTestFinished(() => {
    canvasAvailability.missing = false
  })
}

/**
 * Leaves `touchCount` and `touchZooming` set with no finger on the glass, the
 * state the canvas used to be stuck in. A pinch whose `touchend` never reaches
 * the listener is one way to get here; the fix is indifferent to which.
 */
function strandGestureState() {
  const doomed = document.createElement('div')
  container.append(doomed)
  const twoFingers = [touchAt(doomed), touchAt(doomed, 100)]
  dispatchTouch('touchstart', twoFingers)
  dispatchTouch('touchmove', [touchAt(doomed), touchAt(doomed, 60)])
  doomed.remove()
}

describe('Comfy.SimpleTouchSupport', () => {
  beforeEach(() => {
    document.body.append(container)
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    hidden.mockRestore()
    processMouseDown.mockClear()
  })

  it('lets the next touch through after a gesture left state behind', () => {
    strandGestureState()

    pressPointer({ isPrimary: true })
    expect(processMouseDown).toHaveBeenCalledOnce()
  })

  it('still blocks a second finger during a live gesture', () => {
    pressPointer({ isPrimary: true })
    dispatchTouch('touchstart', [touchAt(canvasEl)])
    processMouseDown.mockClear()

    pressPointer({ isPrimary: false })
    expect(processMouseDown).not.toHaveBeenCalled()
  })

  it.for(['mouse', 'pen'] as const)(
    'still blocks a %s press during a live pinch',
    (pointerType) => {
      const twoFingers = [touchAt(canvasEl), touchAt(canvasEl, 100)]
      dispatchTouch('touchstart', twoFingers)
      dispatchTouch('touchmove', twoFingers)

      pressPointer({ pointerType, isPrimary: true })
      expect(processMouseDown).not.toHaveBeenCalled()
    }
  )

  it('presses through to the original when no canvas exists', () => {
    withoutCanvas()

    const canvas = pressPointer({ isPrimary: true })

    expect(processMouseDown).toHaveBeenCalledOnce()
    expect(canvas.pointer.isDown).toBe(false)
  })

  it('ignores a pinch when no canvas exists', () => {
    withoutCanvas()
    const twoFingers = [touchAt(canvasEl), touchAt(canvasEl, 100)]

    dispatchTouch('touchstart', twoFingers)
    dispatchTouch('touchmove', twoFingers)
    pressPointer({ isPrimary: true })

    expect(processMouseDown).toHaveBeenCalledOnce()
  })

  describe('pinch zoom', () => {
    function resetViewport() {
      ds.scale = 1
      ds.offset[0] = 0
      ds.offset[1] = 0
    }

    it.for([
      { name: 'start on the same point', start: 0, move: 100 },
      { name: 'start and stay on the same point', start: 0, move: 0 },
      { name: 'end on the same point', start: 100, move: 0 }
    ])(
      'leaves the viewport unchanged when two fingers $name',
      ({ start, move }) => {
        resetViewport()

        dispatchTouch('touchstart', [
          touchAt(canvasEl),
          touchAt(canvasEl, start)
        ])
        dispatchTouch('touchmove', [touchAt(canvasEl), touchAt(canvasEl, move)])

        expect({ scale: ds.scale, offset: [...ds.offset] }).toEqual({
          scale: 1,
          offset: [0, 0]
        })
      }
    )

    it('waits for a usable distance before measuring a pinch', () => {
      resetViewport()

      dispatchTouch('touchstart', [touchAt(canvasEl), touchAt(canvasEl)])
      dispatchTouch('touchmove', [touchAt(canvasEl), touchAt(canvasEl, 7)])
      dispatchTouch('touchmove', [touchAt(canvasEl), touchAt(canvasEl, 50)])

      expect(ds.scale).toBe(1)
    })

    it('zooms once fingers that started on the same point move apart', () => {
      resetViewport()

      dispatchTouch('touchstart', [touchAt(canvasEl), touchAt(canvasEl)])
      dispatchTouch('touchmove', [touchAt(canvasEl), touchAt(canvasEl, 50)])
      dispatchTouch('touchmove', [touchAt(canvasEl), touchAt(canvasEl, 100)])

      expect(ds.scale).toBe(2)
    })

    it('uses the minimum scale when converting pinch movement to an offset', () => {
      resetViewport()
      ds.scale = ds.min_scale

      dispatchTouch('touchstart', [touchAt(canvasEl), touchAt(canvasEl, 100)])
      dispatchTouch('touchmove', [touchAt(canvasEl, 20), touchAt(canvasEl, 70)])

      expect({ scale: ds.scale, offset: [...ds.offset] }).toEqual({
        scale: 0.1,
        offset: [-50, 0]
      })
    })
  })
})
