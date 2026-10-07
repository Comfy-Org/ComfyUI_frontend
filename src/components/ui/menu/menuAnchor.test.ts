import { describe, expect, it, vi } from 'vitest'

import { getMenuAnchorPosition } from './menuAnchor'

describe('getMenuAnchorPosition', () => {
  it.for([
    { type: 'click', detail: 1 },
    { type: 'contextmenu', detail: 0 }
  ])('preserves zero pointer coordinates for $type', ({ type, detail }) => {
    const target = document.createElement('button')
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(20, 30, 40, 50)
    )
    const event = new MouseEvent(type, { detail, clientX: 0, clientY: 0 })
    Object.defineProperty(event, 'currentTarget', { value: target })

    expect(getMenuAnchorPosition(event)).toEqual({ x: 0, y: 0 })
  })

  it.for([new Event('open'), new MouseEvent('click', { detail: 0 })])(
    'anchors non-pointer activation to the trigger',
    (event) => {
      const target = document.createElement('button')
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(20, 30, 40, 50)
      )
      Object.defineProperty(event, 'target', { value: target })

      expect(getMenuAnchorPosition(event)).toEqual({ x: 20, y: 30 })
    }
  )
})
