import { describe, expect, it } from 'vitest'

import { KeyComboImpl } from './keyCombo'

describe('KeyComboImpl', () => {
  function mockKeyEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
    return {
      key: '',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      ...overrides
    } as KeyboardEvent
  }

  describe('getKeySequences', () => {
    it.each([
      {
        event: { key: 'Shift', shiftKey: true },
        expected: ['Shift'],
        label: 'Shift'
      },
      {
        event: { key: 'Control', ctrlKey: true },
        expected: ['Ctrl'],
        label: 'Control'
      },
      {
        event: { key: 'Alt', altKey: true },
        expected: ['Alt'],
        label: 'Alt'
      },
      {
        event: { key: 'Meta', metaKey: true },
        expected: ['Ctrl'],
        label: 'Meta'
      }
    ])(
      'does not duplicate a single $label modifier press',
      ({ event, expected }) => {
        const combo = KeyComboImpl.fromEvent(mockKeyEvent(event))

        expect(combo.getKeySequences()).toEqual(expected)
        expect(combo.toString()).toBe(expected.join(' + '))
      }
    )

    it('lists held modifiers once when the pressed key is also a modifier', () => {
      const combo = KeyComboImpl.fromEvent(
        mockKeyEvent({ key: 'Shift', ctrlKey: true, shiftKey: true })
      )

      expect(combo.getKeySequences()).toEqual(['Ctrl', 'Shift'])
      expect(combo.toString()).toBe('Ctrl + Shift')
    })

    it('keeps the primary key for non-modifier shortcuts', () => {
      const combo = KeyComboImpl.fromEvent(
        mockKeyEvent({ key: 'k', ctrlKey: true, shiftKey: true })
      )

      expect(combo.getKeySequences()).toEqual(['Ctrl', 'Shift', 'k'])
      expect(combo.toString()).toBe('Ctrl + Shift + k')
    })
  })

  describe('isBrowserReserved', () => {
    it.each([
      { key: 't', ctrl: true, label: 'Ctrl + t' },
      { key: 'w', ctrl: true, label: 'Ctrl + w' },
      { key: 'F12', label: 'F12' },
      { key: 'n', ctrl: true, shift: true, label: 'Ctrl + Shift + n' },
      { key: 'r', ctrl: true, label: 'Ctrl + r' },
      { key: 'F5', label: 'F5' }
    ])('returns true for $label', ({ key, ctrl, shift }) => {
      const combo = new KeyComboImpl({
        key,
        ctrl: ctrl ?? false,
        alt: false,
        shift: shift ?? false
      })
      expect(combo.isBrowserReserved).toBe(true)
    })

    it.each([
      { key: 'k', ctrl: true, label: 'Ctrl + k' },
      { key: 's', alt: true, label: 'Alt + s' },
      { key: 'z', ctrl: true, label: 'Ctrl + z' },
      { key: 'F6', label: 'F6' }
    ])('returns false for $label', ({ key, ctrl, alt }) => {
      const combo = new KeyComboImpl({
        key,
        ctrl: ctrl ?? false,
        alt: alt ?? false,
        shift: false
      })
      expect(combo.isBrowserReserved).toBe(false)
    })
  })
})
