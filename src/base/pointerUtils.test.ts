import { describe, expect, it } from 'vitest'

import {
  isMiddleButtonEvent,
  isMiddleButtonHeld,
  isMiddlePointerInput
} from '@/base/pointerUtils'

describe('pointerUtils', () => {
  describe('isMiddlePointerInput', () => {
    it.for([
      {
        name: 'accepts a middle-button pointerdown',
        event: new PointerEvent('pointerdown', { button: 1, buttons: 4 }),
        expected: true
      },
      {
        name: 'accepts strict middle-only held buttons',
        event: new PointerEvent('pointermove', { buttons: 4 }),
        expected: true
      },
      {
        name: 'rejects chorded pointerdown when middle is only incidentally held',
        event: new PointerEvent('pointerdown', { button: 0, buttons: 5 }),
        expected: false
      }
    ])('$name', ({ event, expected }) => {
      expect(isMiddlePointerInput(event)).toBe(expected)
    })
  })

  describe('isMiddleButtonHeld', () => {
    it.for([
      {
        name: 'accepts the middle-button bit alone',
        event: new PointerEvent('pointermove', { buttons: 4 }),
        expected: true
      },
      {
        name: 'accepts chorded moves that include the middle-button bit',
        event: new PointerEvent('pointermove', { buttons: 5 }),
        expected: true
      },
      {
        name: 'accepts pointercancel when the middle-button bit is still held',
        event: new PointerEvent('pointercancel', { buttons: 4 }),
        expected: true
      },
      {
        name: 'rejects primary-button-only moves',
        event: new PointerEvent('pointermove', { buttons: 1 }),
        expected: false
      }
    ])('$name', ({ event, expected }) => {
      expect(isMiddleButtonHeld(event)).toBe(expected)
    })
  })

  describe('isMiddleButtonEvent', () => {
    it.for([
      {
        name: 'accepts a middle-button pointerup',
        event: new PointerEvent('pointerup', { button: 1 }),
        expected: true
      },
      {
        name: 'rejects a non-middle changed button even when middle is held',
        event: new MouseEvent('auxclick', { button: 2, buttons: 4 }),
        expected: false
      }
    ])('$name', ({ event, expected }) => {
      expect(isMiddleButtonEvent(event)).toBe(expected)
    })
  })
})
