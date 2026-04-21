import { describe, expect, it } from 'vitest'

import {
  isMiddleButtonEvent,
  isMiddleButtonHeld,
  isMiddleForPointerEvent,
  isMiddlePointerInput
} from '@/base/pointerUtils'

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

describe('isMiddleButtonHeld', () => {
  it('returns true when middle is the only held button (buttons=4)', () => {
    const event = new MouseEvent('mousemove', { buttons: 4 })
    expect(isMiddleButtonHeld(event)).toBe(true)
  })

  it('returns true when middle is held chorded with left (buttons=5)', () => {
    const event = new MouseEvent('mousemove', { buttons: 5 })
    expect(isMiddleButtonHeld(event)).toBe(true)
  })

  it('returns true when middle is held chorded with right (buttons=6)', () => {
    const event = new MouseEvent('mousemove', { buttons: 6 })
    expect(isMiddleButtonHeld(event)).toBe(true)
  })

  it('returns true when all three buttons are held (buttons=7)', () => {
    const event = new MouseEvent('mousemove', { buttons: 7 })
    expect(isMiddleButtonHeld(event)).toBe(true)
  })

  it('returns false when only left is held (buttons=1)', () => {
    const event = new MouseEvent('mousemove', { buttons: 1 })
    expect(isMiddleButtonHeld(event)).toBe(false)
  })

  it('returns false when only right is held (buttons=2)', () => {
    const event = new MouseEvent('mousemove', { buttons: 2 })
    expect(isMiddleButtonHeld(event)).toBe(false)
  })

  it('returns false when no buttons are held (buttons=0)', () => {
    const event = new MouseEvent('mousemove', { buttons: 0 })
    expect(isMiddleButtonHeld(event)).toBe(false)
  })

  it('ignores button field — only buttons (held) matters', () => {
    // Synthetic: pointerdown with button===1 but buttons=0 (quirky UA). Held
    // semantics say middle is NOT currently held, so false.
    const event = new MouseEvent('mousedown', { button: 1, buttons: 0 })
    expect(isMiddleButtonHeld(event)).toBe(false)
  })

  it('works for PointerEvent with buttons=4', () => {
    const event = new PointerEvent('pointermove', { buttons: 4 })
    expect(isMiddleButtonHeld(event)).toBe(true)
  })
})

describe('isMiddleButtonEvent', () => {
  it('returns true when button is 1 (middle)', () => {
    const event = new MouseEvent('mousedown', { button: 1 })
    expect(isMiddleButtonEvent(event)).toBe(true)
  })

  it('returns true on pointerup with button=1 even if buttons=0', () => {
    // On middle pointerup the button just released, so buttons typically
    // drops middle. Use the button field to identify middle-up events.
    const event = new PointerEvent('pointerup', { button: 1, buttons: 0 })
    expect(isMiddleButtonEvent(event)).toBe(true)
  })

  it('returns false when button is 0 (left)', () => {
    const event = new MouseEvent('mousedown', { button: 0 })
    expect(isMiddleButtonEvent(event)).toBe(false)
  })

  it('returns false when button is 2 (right)', () => {
    const event = new MouseEvent('mousedown', { button: 2 })
    expect(isMiddleButtonEvent(event)).toBe(false)
  })

  it('ignores buttons bitmask — only button field matters', () => {
    // buttons=5 (middle held while left press fires) but button=0 means this
    // is a left-button event, not a middle-button event.
    const event = new MouseEvent('mousedown', { button: 0, buttons: 5 })
    expect(isMiddleButtonEvent(event)).toBe(false)
  })
})

describe('isMiddleForPointerEvent', () => {
  it('dispatches pointerdown through isMiddlePointerInput (strict buttons)', () => {
    // Middle-only pointerdown → true
    expect(
      isMiddleForPointerEvent(
        new PointerEvent('pointerdown', { button: 1, buttons: 4 })
      )
    ).toBe(true)

    // Chorded pointerdown (left pressed while middle is incidentally held) →
    // strict semantics reject; must NOT forward as middle.
    expect(
      isMiddleForPointerEvent(
        new PointerEvent('pointerdown', { button: 0, buttons: 5 })
      )
    ).toBe(false)
  })

  it('dispatches pointermove through isMiddleButtonHeld (bitmask)', () => {
    // Middle-only move → true
    expect(
      isMiddleForPointerEvent(new PointerEvent('pointermove', { buttons: 4 }))
    ).toBe(true)

    // Chorded move (middle + left, middle + right, all three) → still held,
    // forwarding must survive the chord.
    expect(
      isMiddleForPointerEvent(new PointerEvent('pointermove', { buttons: 5 }))
    ).toBe(true)
    expect(
      isMiddleForPointerEvent(new PointerEvent('pointermove', { buttons: 6 }))
    ).toBe(true)
    expect(
      isMiddleForPointerEvent(new PointerEvent('pointermove', { buttons: 7 }))
    ).toBe(true)

    // No middle bit → false
    expect(
      isMiddleForPointerEvent(new PointerEvent('pointermove', { buttons: 1 }))
    ).toBe(false)
  })

  it('dispatches pointerup through isMiddleButtonEvent (button field)', () => {
    // Middle released, buttons already dropped middle — must still identify
    // this as a middle event via `button`.
    expect(
      isMiddleForPointerEvent(
        new PointerEvent('pointerup', { button: 1, buttons: 0 })
      )
    ).toBe(true)

    // Non-middle pointerup → false
    expect(
      isMiddleForPointerEvent(
        new PointerEvent('pointerup', { button: 0, buttons: 0 })
      )
    ).toBe(false)
  })

  it('falls back to isMiddleButtonEvent for other event types (e.g. auxclick)', () => {
    expect(
      isMiddleForPointerEvent(new MouseEvent('auxclick', { button: 1 }))
    ).toBe(true)
    expect(
      isMiddleForPointerEvent(new MouseEvent('auxclick', { button: 2 }))
    ).toBe(false)
  })
})
