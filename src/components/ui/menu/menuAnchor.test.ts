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

    expect(
      getMenuAnchor(event, { target: 'current', verticalEdge: 'bottom' })
    ).toEqual({ x: 0, y: 0 })
  })

  it.for([
    { verticalEdge: 'bottom', mode: 'current', y: 80 },
    { verticalEdge: 'top', mode: 'current-or-event', y: 30 }
  ] as const)(
    'uses the %s edge for non-mouse events',
    ({ verticalEdge, mode, y }) => {
      const target = document.createElement('button')
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(20, 30, 40, 50)
      )
      const event = new Event('open')
      Object.defineProperty(
        event,
        mode === 'current' ? 'currentTarget' : 'target',
        {
          value: target
        }
      )

      expect(getMenuAnchor(event, { target: mode, verticalEdge })).toEqual({
        x: 20,
        y
      })
    }
  )
})
