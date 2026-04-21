import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { attachContextMenuGuard } from './load3dContextMenuGuard'

function rightMouse(type: string, x: number, y: number, buttons = 2) {
  const event = new MouseEvent(type, {
    button: 2,
    buttons,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true
  })
  return event
}

describe('attachContextMenuGuard', () => {
  let target: HTMLElement
  let onMenu: ReturnType<typeof vi.fn<(event: MouseEvent) => void>>
  let dispose: () => void

  beforeEach(() => {
    target = document.createElement('div')
    document.body.appendChild(target)
    onMenu = vi.fn<(event: MouseEvent) => void>()
  })

  afterEach(() => {
    dispose?.()
    target.remove()
  })

  it('invokes onMenu for a right-click without drag movement', () => {
    dispose = attachContextMenuGuard(target, onMenu)

    target.dispatchEvent(rightMouse('mousedown', 100, 100))
    target.dispatchEvent(rightMouse('contextmenu', 100, 100))

    expect(onMenu).toHaveBeenCalledOnce()
  })

  it('preventDefault is called on the contextmenu event when menu fires', () => {
    dispose = attachContextMenuGuard(target, onMenu)

    target.dispatchEvent(rightMouse('mousedown', 0, 0))
    const contextEvent = rightMouse('contextmenu', 0, 0)
    target.dispatchEvent(contextEvent)

    expect(contextEvent.defaultPrevented).toBe(true)
  })

  it('suppresses onMenu when the mouse moved past the drag threshold', () => {
    dispose = attachContextMenuGuard(target, onMenu, { dragThreshold: 5 })

    target.dispatchEvent(rightMouse('mousedown', 100, 100))
    target.dispatchEvent(rightMouse('mousemove', 120, 120))
    target.dispatchEvent(rightMouse('contextmenu', 120, 120))

    expect(onMenu).not.toHaveBeenCalled()
  })

  it('still fires onMenu when the mouse moved within the drag threshold', () => {
    dispose = attachContextMenuGuard(target, onMenu, { dragThreshold: 10 })

    target.dispatchEvent(rightMouse('mousedown', 100, 100))
    target.dispatchEvent(rightMouse('mousemove', 103, 104))
    target.dispatchEvent(rightMouse('contextmenu', 103, 104))

    expect(onMenu).toHaveBeenCalledOnce()
  })

  it('detects a drag from start to contextmenu even without mousemove events', () => {
    dispose = attachContextMenuGuard(target, onMenu, { dragThreshold: 5 })

    target.dispatchEvent(rightMouse('mousedown', 100, 100))
    target.dispatchEvent(rightMouse('contextmenu', 200, 200))

    expect(onMenu).not.toHaveBeenCalled()
  })

  it('resets drag state between right-clicks', () => {
    dispose = attachContextMenuGuard(target, onMenu, { dragThreshold: 5 })

    target.dispatchEvent(rightMouse('mousedown', 100, 100))
    target.dispatchEvent(rightMouse('mousemove', 200, 200))
    target.dispatchEvent(rightMouse('contextmenu', 200, 200))
    expect(onMenu).not.toHaveBeenCalled()

    target.dispatchEvent(rightMouse('mousedown', 50, 50))
    target.dispatchEvent(rightMouse('contextmenu', 50, 50))
    expect(onMenu).toHaveBeenCalledOnce()
  })

  it('ignores onMenu when isDisabled returns true', () => {
    let disabled = true
    dispose = attachContextMenuGuard(target, onMenu, {
      isDisabled: () => disabled
    })

    target.dispatchEvent(rightMouse('mousedown', 10, 10))
    target.dispatchEvent(rightMouse('contextmenu', 10, 10))
    expect(onMenu).not.toHaveBeenCalled()

    disabled = false
    target.dispatchEvent(rightMouse('mousedown', 10, 10))
    target.dispatchEvent(rightMouse('contextmenu', 10, 10))
    expect(onMenu).toHaveBeenCalledOnce()
  })

  it('stops listening after dispose', () => {
    dispose = attachContextMenuGuard(target, onMenu)
    dispose()

    target.dispatchEvent(rightMouse('mousedown', 10, 10))
    target.dispatchEvent(rightMouse('contextmenu', 10, 10))

    expect(onMenu).not.toHaveBeenCalled()
  })

  it('ignores mousemove events without the right button held', () => {
    dispose = attachContextMenuGuard(target, onMenu, { dragThreshold: 5 })

    target.dispatchEvent(rightMouse('mousedown', 100, 100))
    target.dispatchEvent(rightMouse('mousemove', 200, 200, 0))
    target.dispatchEvent(rightMouse('contextmenu', 100, 100))

    expect(onMenu).toHaveBeenCalledOnce()
  })

  it('detects a chorded (LMB+RMB) right-drag via buttons bitmask', () => {
    dispose = attachContextMenuGuard(target, onMenu, { dragThreshold: 5 })

    target.dispatchEvent(rightMouse('mousedown', 100, 100))
    target.dispatchEvent(rightMouse('mousemove', 200, 200, 3))
    target.dispatchEvent(rightMouse('contextmenu', 100, 100))

    expect(onMenu).not.toHaveBeenCalled()
  })
})
