import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DragAndScale } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { app as comfyApp } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'

type Viewport = Pick<
  DragAndScale,
  'scale' | 'offset' | 'min_scale' | 'max_scale'
>

const { canvasEl, container } = vi.hoisted(() => {
  const container = document.createElement('div')
  const canvasEl = document.createElement('canvas')
  container.append(canvasEl)
  return { container, canvasEl }
})

const processMouseDown = vi.fn()
const processMouseMove = vi.fn()

vi.mock(import('@/scripts/app'), () => {
  const ds: Viewport = {
    scale: 1,
    offset: [0, 0],
    min_scale: 0.1,
    max_scale: 10
  }
  return {
    app: fromPartial<typeof comfyApp>({
      registerExtension: (ext: ComfyExtension) => ext.setup?.(fromPartial({})),
      canvasEl,
      canvas: fromPartial({
        ds,
        pointer: { isDown: false },
        setDirty: vi.fn()
      })
    })
  }
})

LGraphCanvas.prototype.processMouseDown = processMouseDown
LGraphCanvas.prototype.processMouseMove = processMouseMove

function canvasPointerHandlers() {
  const { processMouseDown, processMouseMove } = LGraphCanvas.prototype
  return { processMouseDown, processMouseMove }
}

await import('./simpleTouchSupport')
const { installTouchPointerGuards } = await import('./touchPointerGuards')
const handlersAtImport = canvasPointerHandlers()
installTouchPointerGuards()
const handlersAfterInstall = canvasPointerHandlers()

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
  LGraphCanvas.prototype.processMouseDown.call(
    fromPartial<LGraphCanvas>({}),
    new PointerEvent('pointerdown', { pointerType: 'touch', ...init })
  )
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
})

describe('touch pointer guards', () => {
  it('leaves the canvas pointer handlers untouched at import', () => {
    expect(handlersAtImport.processMouseDown).toBe(processMouseDown)
    expect(handlersAtImport.processMouseMove).toBe(processMouseMove)
  })

  it('wraps the canvas pointer handlers when installed', () => {
    expect(handlersAfterInstall.processMouseDown).not.toBe(processMouseDown)
    expect(handlersAfterInstall.processMouseMove).not.toBe(processMouseMove)
  })

  it('wraps the canvas pointer handlers only once when installed again', () => {
    installTouchPointerGuards()

    const handlers = canvasPointerHandlers()
    expect(handlers.processMouseDown).toBe(
      handlersAfterInstall.processMouseDown
    )
    expect(handlers.processMouseMove).toBe(
      handlersAfterInstall.processMouseMove
    )
  })
})
