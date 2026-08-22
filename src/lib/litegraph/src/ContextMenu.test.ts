import { afterEach, describe, expect, it, vi } from 'vitest'

import { ContextMenu } from './ContextMenu'

function pointerUpEvent(pointerType: 'touch' | 'pen') {
  return new PointerEvent('pointerup', {
    bubbles: true,
    cancelable: true,
    clientX: 20,
    clientY: 20,
    pointerType
  })
}

function pointerDownEvent(pointerType: 'touch' | 'pen') {
  return new PointerEvent('pointerdown', {
    bubbles: true,
    cancelable: true,
    clientX: 20,
    clientY: 20,
    pointerType
  })
}

function mouseEvent() {
  return new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    clientX: 20,
    clientY: 20
  })
}

function getMenuItem() {
  const item = document.querySelector<HTMLElement>('.litemenu-entry')
  if (!item) throw new Error('Expected context menu item')
  return item
}

describe('ContextMenu', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it.each(['touch', 'pen'] as const)(
    'ignores the synthetic click that follows %s menu opening',
    (pointerType) => {
      const callback = vi.fn()

      new ContextMenu(['first'], {
        event: pointerUpEvent(pointerType),
        callback
      })

      getMenuItem().dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )

      expect(callback).not.toHaveBeenCalled()
      expect(document.querySelector('.litecontextmenu')).toBeInTheDocument()

      getMenuItem().dispatchEvent(pointerDownEvent(pointerType))
      getMenuItem().dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )

      expect(callback).toHaveBeenCalledWith(
        'first',
        expect.any(Object),
        expect.any(MouseEvent),
        expect.any(ContextMenu),
        undefined
      )
      expect(document.querySelector('.litecontextmenu')).not.toBeInTheDocument()
    }
  )

  it('allows immediate item clicks for mouse-opened menus', () => {
    const callback = vi.fn()

    new ContextMenu(['first'], {
      event: mouseEvent(),
      callback
    })

    getMenuItem().dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    )

    expect(callback).toHaveBeenCalledWith(
      'first',
      expect.any(Object),
      expect.any(MouseEvent),
      expect.any(ContextMenu),
      undefined
    )
    expect(document.querySelector('.litecontextmenu')).not.toBeInTheDocument()
  })
})
