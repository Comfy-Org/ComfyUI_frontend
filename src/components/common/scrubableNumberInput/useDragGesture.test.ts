import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EffectScope } from 'vue'
import { effectScope, ref } from 'vue'

import { useDragGesture } from './useDragGesture'

type DragOptions = NonNullable<Parameters<typeof useDragGesture>[1]>

// Explicitly-typed mocks so the callbacks stay assignable to DragOptions and
// the merged setup object needs no cast (which would otherwise mask typos).
interface Callbacks {
  onClick: Mock<(event: PointerEvent) => void>
  onDragStart: Mock<(event: PointerEvent) => void>
  onDrag: Mock<(dx: number, dy: number, event: PointerEvent) => void>
  onDragEnd: Mock<(event: PointerEvent) => void>
}

function makeEvent(type: string, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, {
    button: 0,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'mouse',
    ...init
  })
}

let scope: EffectScope | null = null
let el: HTMLElement
let cb: Callbacks

function setLocked(target: Element | null) {
  ;(
    document as unknown as { pointerLockElement: Element | null }
  ).pointerLockElement = target
}

function mount(options: Partial<DragOptions> = {}) {
  el = document.createElement('div')
  el.setPointerCapture = vi.fn()
  el.releasePointerCapture = vi.fn()
  // VueUse usePointerLock resolves the lock by awaiting pointerlockchange.
  ;(el as unknown as { requestPointerLock: () => void }).requestPointerLock =
    vi.fn(() => {
      setLocked(el)
      document.dispatchEvent(new Event('pointerlockchange'))
    })
  document.body.appendChild(el)

  cb = {
    onClick: vi.fn<(event: PointerEvent) => void>(),
    onDragStart: vi.fn<(event: PointerEvent) => void>(),
    onDrag: vi.fn<(dx: number, dy: number, event: PointerEvent) => void>(),
    onDragEnd: vi.fn<(event: PointerEvent) => void>()
  }
  scope = effectScope()
  scope.run(() => useDragGesture(ref(el), { ...cb, ...options }))
}

beforeEach(() => {
  // usePointerLock checks `'pointerLockElement' in document` once at setup,
  // so the property must exist before mount(). Default to unlocked.
  Object.defineProperty(document, 'pointerLockElement', {
    value: null,
    writable: true,
    configurable: true
  })
  ;(document as unknown as { exitPointerLock: () => void }).exitPointerLock =
    vi.fn(() => {
      setLocked(null)
      document.dispatchEvent(new Event('pointerlockchange'))
    })
})

afterEach(() => {
  scope?.stop()
  scope = null
  el?.remove()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('useDragGesture', () => {
  it('treats a press with no movement as a click, not a drag', () => {
    mount()
    el.dispatchEvent(makeEvent('pointerdown', { clientX: 10, clientY: 10 }))
    el.dispatchEvent(makeEvent('pointerup', { clientX: 10, clientY: 10 }))

    expect(cb.onClick).toHaveBeenCalledTimes(1)
    expect(cb.onDragStart).not.toHaveBeenCalled()
    expect(cb.onDrag).not.toHaveBeenCalled()
    expect(cb.onDragEnd).not.toHaveBeenCalled()
  })

  it('starts a drag once movement crosses the threshold and ends it on up', () => {
    mount()
    el.dispatchEvent(makeEvent('pointerdown', { clientX: 0, clientY: 0 }))
    // Below the 1px mouse threshold — still just a potential click.
    el.dispatchEvent(makeEvent('pointermove', { clientX: 0, clientY: 0 }))
    expect(cb.onDragStart).not.toHaveBeenCalled()

    el.dispatchEvent(makeEvent('pointermove', { clientX: 10, clientY: 2 }))
    expect(cb.onDragStart).toHaveBeenCalledTimes(1)
    expect(cb.onDrag).toHaveBeenCalledTimes(1)

    el.dispatchEvent(makeEvent('pointerup', { clientX: 10, clientY: 2 }))
    expect(cb.onDragEnd).toHaveBeenCalledTimes(1)
    expect(cb.onClick).not.toHaveBeenCalled()
  })

  it('ignores non-primary buttons, wrong pointer types, and disabled state', () => {
    mount({ disabled: true })
    el.dispatchEvent(makeEvent('pointerdown', { clientX: 0, clientY: 0 }))
    el.dispatchEvent(makeEvent('pointerup', { clientX: 0, clientY: 0 }))
    expect(cb.onClick).not.toHaveBeenCalled()

    scope?.stop()
    mount({ pointerType: ['mouse'] })
    el.dispatchEvent(
      makeEvent('pointerdown', { clientX: 0, clientY: 0, button: 1 })
    )
    el.dispatchEvent(makeEvent('pointerup', { clientX: 0, clientY: 0 }))
    expect(cb.onClick).not.toHaveBeenCalled()

    el.dispatchEvent(
      makeEvent('pointerdown', { clientX: 0, clientY: 0, pointerType: 'touch' })
    )
    el.dispatchEvent(makeEvent('pointerup', { clientX: 0, clientY: 0 }))
    expect(cb.onClick).not.toHaveBeenCalled()
  })

  it('fires the drag via the long-press timer without any movement', () => {
    vi.useFakeTimers()
    mount({ dragDelaySeconds: 0.5 })
    el.dispatchEvent(makeEvent('pointerdown', { clientX: 0, clientY: 0 }))
    expect(cb.onDragStart).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(cb.onDragStart).toHaveBeenCalledTimes(1)
  })

  it('requests pointer lock on drag start and releases it on pointer up', () => {
    mount({ lockPointer: true })
    el.dispatchEvent(makeEvent('pointerdown', { clientX: 0, clientY: 0 }))
    el.dispatchEvent(makeEvent('pointermove', { clientX: 20, clientY: 0 }))

    expect(
      (el as unknown as { requestPointerLock: ReturnType<typeof vi.fn> })
        .requestPointerLock
    ).toHaveBeenCalledTimes(1)

    el.dispatchEvent(makeEvent('pointerup', { clientX: 20, clientY: 0 }))
    expect(
      (document as unknown as { exitPointerLock: ReturnType<typeof vi.fn> })
        .exitPointerLock
    ).toHaveBeenCalledTimes(1)
  })

  it('uses clientX/Y deltas when not pointer-locked (touch path)', () => {
    mount()
    el.dispatchEvent(
      makeEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        pointerType: 'touch'
      })
    )
    // Cross the 5px touch threshold; movementX/Y are absent (touch).
    el.dispatchEvent(
      makeEvent('pointermove', {
        clientX: 130,
        clientY: 100,
        pointerType: 'touch'
      })
    )
    const [dx, dy] = cb.onDrag.mock.calls.at(-1)!
    expect(dx).toBe(30)
    expect(dy).toBe(0)
  })

  it('uses movementX/Y when pointer is locked (cursor pinned)', () => {
    mount({ lockPointer: true })
    el.dispatchEvent(makeEvent('pointerdown', { clientX: 50, clientY: 50 }))
    el.dispatchEvent(makeEvent('pointermove', { clientX: 60, clientY: 50 }))
    cb.onDrag.mockClear()

    // Lock active: clientX/Y is now pinned (unchanged), movement carries delta.
    setLocked(el)
    el.dispatchEvent(
      makeEvent('pointermove', {
        clientX: 60,
        clientY: 50,
        movementX: 8,
        movementY: -3
      })
    )
    const [dx, dy] = cb.onDrag.mock.calls.at(-1)!
    expect(dx).toBe(8)
    expect(dy).toBe(-3)
  })

  it('ends the drag and releases pointer capture on pointercancel', () => {
    mount()
    el.dispatchEvent(makeEvent('pointerdown', { clientX: 0, clientY: 0 }))
    el.dispatchEvent(makeEvent('pointermove', { clientX: 10, clientY: 0 }))
    el.dispatchEvent(makeEvent('pointercancel', { clientX: 10, clientY: 0 }))

    expect(cb.onDragEnd).toHaveBeenCalledTimes(1)
    expect(el.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('ends the drag and releases pointer capture on pointerleave', () => {
    mount()
    el.dispatchEvent(makeEvent('pointerdown', { clientX: 0, clientY: 0 }))
    el.dispatchEvent(makeEvent('pointermove', { clientX: 10, clientY: 0 }))
    el.dispatchEvent(makeEvent('pointerleave', { clientX: 10, clientY: 0 }))

    expect(cb.onDragEnd).toHaveBeenCalledTimes(1)
    expect(el.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('clears the long-press timer on pointer release so it cannot fire late', () => {
    vi.useFakeTimers()
    mount({ dragDelaySeconds: 0.5 })
    el.dispatchEvent(makeEvent('pointerdown', { clientX: 0, clientY: 0 }))
    el.dispatchEvent(makeEvent('pointerup', { clientX: 0, clientY: 0 }))

    vi.advanceTimersByTime(500)
    expect(cb.onDragStart).not.toHaveBeenCalled()
    expect(cb.onClick).toHaveBeenCalledTimes(1)
  })
})
