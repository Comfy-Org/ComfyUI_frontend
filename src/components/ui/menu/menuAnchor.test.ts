import { describe, expect, it, vi } from 'vitest'

import { getMenuAnchor } from './menuAnchor'

describe('getMenuAnchor', () => {
  it('preserves zero mouse coordinates instead of using the element bounds', () => {
    const target = document.createElement('button')
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(20, 30, 40, 50)
    )
    const event = new MouseEvent('click', { clientX: 0, clientY: 0 })
    Object.defineProperty(event, 'currentTarget', { value: target })

    expect(getMenuAnchor(event)).toEqual({ x: 0, y: 0 })
  })

  it('uses the trigger position for non-mouse events', () => {
    const target = document.createElement('button')
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(20, 30, 40, 50)
    )
    const event = new Event('open')
    Object.defineProperty(event, 'target', { value: target })

    expect(getMenuAnchor(event)).toEqual({ x: 20, y: 30 })
  })
})
