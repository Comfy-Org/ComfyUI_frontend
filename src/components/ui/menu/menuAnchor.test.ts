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

    expect(getMenuAnchor(event, 'context')).toEqual({ x: 0, y: 0 })
  })

  it.for([
    { kind: 'dropdown', y: 80 },
    { kind: 'context', y: 30 }
  ] as const)(
    'uses the $kind trigger edge for non-mouse events',
    ({ kind, y }) => {
      const target = document.createElement('button')
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(20, 30, 40, 50)
      )
      const event = new Event('open')
      Object.defineProperty(event, 'target', { value: target })

      expect(getMenuAnchor(event, kind)).toEqual({
        x: 20,
        y
      })
    }
  )

  it.for([
    { input: 'keyboard', clientX: 0, clientY: 0 },
    { input: 'pointer', clientX: 42, clientY: 51 }
  ])(
    'anchors a $input dropdown click below the trigger',
    ({ clientX, clientY }) => {
      const target = document.createElement('button')
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(20, 30, 40, 50)
      )
      const event = new MouseEvent('click', { clientX, clientY })
      Object.defineProperty(event, 'currentTarget', { value: target })

      expect(getMenuAnchor(event, 'dropdown')).toEqual({ x: 20, y: 80 })
    }
  )
})
