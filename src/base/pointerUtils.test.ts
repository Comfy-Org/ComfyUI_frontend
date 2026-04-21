import { describe, expect, it } from 'vitest'

import { isMiddlePointerInput } from '@/base/pointerUtils'

describe('isMiddlePointerInput', () => {
  describe('MouseEvent.button semantics (down/up events)', () => {
    it('returns true when button is 1 (middle)', () => {
      const event = new MouseEvent('mousedown', { button: 1 })
      expect(isMiddlePointerInput(event)).toBe(true)
    })

    it('returns false when button is 0 (left)', () => {
      const event = new MouseEvent('mousedown', { button: 0 })
      expect(isMiddlePointerInput(event)).toBe(false)
    })

    it('returns false when button is 2 (right)', () => {
      const event = new MouseEvent('mousedown', { button: 2 })
      expect(isMiddlePointerInput(event)).toBe(false)
    })
  })

  describe('MouseEvent.buttons semantics (move events)', () => {
    it('returns true when buttons bitmask is exactly 4 (middle only)', () => {
      const event = new MouseEvent('mousemove', { button: 0, buttons: 4 })
      expect(isMiddlePointerInput(event)).toBe(true)
    })

    it('returns false when buttons bitmask is 0 (no buttons held)', () => {
      const event = new MouseEvent('mousemove', { button: 0, buttons: 0 })
      expect(isMiddlePointerInput(event)).toBe(false)
    })

    it('returns false when buttons bitmask is 1 (left only)', () => {
      const event = new MouseEvent('mousemove', { button: 0, buttons: 1 })
      expect(isMiddlePointerInput(event)).toBe(false)
    })

    it('returns false when buttons bitmask is 2 (right only)', () => {
      const event = new MouseEvent('mousemove', { button: 0, buttons: 2 })
      expect(isMiddlePointerInput(event)).toBe(false)
    })
  })

  describe('chorded buttons (strict equality, not bitmask)', () => {
    it('returns false when middle+left are held simultaneously (buttons=5)', () => {
      const event = new MouseEvent('mousemove', { button: 0, buttons: 5 })
      expect(isMiddlePointerInput(event)).toBe(false)
    })

    it('returns false when middle+right are held simultaneously (buttons=6)', () => {
      const event = new MouseEvent('mousemove', { button: 0, buttons: 6 })
      expect(isMiddlePointerInput(event)).toBe(false)
    })

    it('returns false when all three buttons are held (buttons=7)', () => {
      const event = new MouseEvent('mousemove', { button: 0, buttons: 7 })
      expect(isMiddlePointerInput(event)).toBe(false)
    })
  })

  describe('PointerEvent', () => {
    it('returns true for pointerdown with button === 1', () => {
      const event = new PointerEvent('pointerdown', { button: 1 })
      expect(isMiddlePointerInput(event)).toBe(true)
    })

    it('returns true for pointermove with buttons === 4', () => {
      const event = new PointerEvent('pointermove', { button: 0, buttons: 4 })
      expect(isMiddlePointerInput(event)).toBe(true)
    })

    it('returns false for pointerdown with button === 0', () => {
      const event = new PointerEvent('pointerdown', { button: 0 })
      expect(isMiddlePointerInput(event)).toBe(false)
    })
  })

  describe('button takes precedence over buttons on down/up events', () => {
    // On pointerdown with button===1, buttons typically also contains 4, but we
    // want to confirm that the 'button' branch wins even when 'buttons'
    // disagrees (e.g., synthetic events in tests, or quirky UA behavior).
    it('returns true when button===1 even if buttons does not include middle', () => {
      const event = new MouseEvent('mousedown', { button: 1, buttons: 0 })
      expect(isMiddlePointerInput(event)).toBe(true)
    })

    it('returns true when button===1 even if buttons reports a different chord', () => {
      const event = new MouseEvent('mousedown', { button: 1, buttons: 2 })
      expect(isMiddlePointerInput(event)).toBe(true)
    })
  })
})
