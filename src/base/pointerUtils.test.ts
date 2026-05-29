import { describe, expect, it } from 'vitest'

import {
  isMiddleButtonEvent,
  isMiddleButtonHeld,
  isMiddlePointerInput
} from '@/base/pointerUtils'

describe('pointerUtils', () => {
  describe('isMiddlePointerInput', () => {
    it('accepts middle-button pointerdown and strict middle-only buttons', () => {
      expect(
        isMiddlePointerInput(
          new PointerEvent('pointerdown', { button: 1, buttons: 4 })
        )
      ).toBe(true)
      expect(
        isMiddlePointerInput(new PointerEvent('pointermove', { buttons: 4 }))
      ).toBe(true)
    })

    it('rejects chorded pointerdown when middle is only incidentally held', () => {
      expect(
        isMiddlePointerInput(
          new PointerEvent('pointerdown', { button: 0, buttons: 5 })
        )
      ).toBe(false)
    })
  })

  describe('isMiddleButtonHeld', () => {
    it('uses the middle-button bit so chorded moves stay active', () => {
      expect(
        isMiddleButtonHeld(new PointerEvent('pointermove', { buttons: 4 }))
      ).toBe(true)
      expect(
        isMiddleButtonHeld(new PointerEvent('pointermove', { buttons: 5 }))
      ).toBe(true)
      expect(
        isMiddleButtonHeld(new PointerEvent('pointermove', { buttons: 1 }))
      ).toBe(false)
    })
  })

  describe('isMiddleButtonEvent', () => {
    it('uses the changed button instead of the held-button bitmask', () => {
      expect(
        isMiddleButtonEvent(new PointerEvent('pointerup', { button: 1 }))
      ).toBe(true)
      expect(
        isMiddleButtonEvent(
          new MouseEvent('auxclick', { button: 2, buttons: 4 })
        )
      ).toBe(false)
    })
  })
})
