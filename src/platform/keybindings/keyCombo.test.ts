import { describe, expect, it } from 'vitest'

import { KeyComboImpl } from './keyCombo'

describe('KeyComboImpl', () => {
  describe('fromEvent resolves physical key from event.code', () => {
    function mockKeyEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
      return {
        key: '',
        code: '',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        ...overrides
      } as KeyboardEvent
    }

    it.each([
      { key: 'µ', code: 'KeyM', expected: 'm' },
      { key: 'ß', code: 'KeyS', expected: 's' },
      { key: 'å', code: 'KeyA', expected: 'a' }
    ])(
      'resolves Alt+$code to "$expected" instead of "$key" (macOS)',
      ({ key, code, expected }) => {
        const combo = KeyComboImpl.fromEvent(
          mockKeyEvent({ key, code, altKey: true })
        )
        expect(combo.key).toBe(expected)
        expect(combo.alt).toBe(true)
      }
    )

    it.each([
      { key: '¡', code: 'Digit1', expected: '1' },
      { key: '€', code: 'Digit2', expected: '2' }
    ])(
      'resolves digit Alt+$code to "$expected" instead of "$key" (macOS)',
      ({ key, code, expected }) => {
        const combo = KeyComboImpl.fromEvent(
          mockKeyEvent({ key, code, altKey: true })
        )
        expect(combo.key).toBe(expected)
        expect(combo.alt).toBe(true)
      }
    )

    it.each([
      { key: '≤', code: 'Comma', expected: ',' },
      { key: '≥', code: 'Period', expected: '.' },
      { key: '\u2019', code: 'BracketRight', expected: ']' },
      { key: '`', code: 'Backquote', expected: '`' },
      { key: '–', code: 'Minus', expected: '-' },
      { key: '≠', code: 'Equal', expected: '=' }
    ])(
      'resolves punctuation Alt+$code to "$expected" instead of "$key" (macOS)',
      ({ key, code, expected }) => {
        const combo = KeyComboImpl.fromEvent(
          mockKeyEvent({ key, code, altKey: true })
        )
        expect(combo.key).toBe(expected)
        expect(combo.alt).toBe(true)
      }
    )

    it.each([
      { key: 'ы', code: 'KeyS', expected: 's', label: 'Ctrl+S Russian' },
      { key: 'я', code: 'KeyZ', expected: 'z', label: 'Ctrl+Z Russian' },
      { key: 'с', code: 'KeyC', expected: 'c', label: 'Meta+C Russian' }
    ])(
      'resolves $label to "$expected" instead of "$key" (non-English layout)',
      ({ key, code, expected, label }) => {
        const useMeta = label.includes('Meta')
        const combo = KeyComboImpl.fromEvent(
          mockKeyEvent({
            key,
            code,
            ctrlKey: !useMeta,
            metaKey: useMeta
          })
        )
        expect(combo.key).toBe(expected)
        expect(combo.ctrl).toBe(true)
      }
    )

    it('uses event.key when no modifier is pressed', () => {
      const combo = KeyComboImpl.fromEvent(
        mockKeyEvent({ key: 'ы', code: 'KeyS' })
      )
      expect(combo.key).toBe('ы')
    })

    it('uses event.key for non-letter/digit codes with modifier', () => {
      const combo = KeyComboImpl.fromEvent(
        mockKeyEvent({ key: 'Enter', code: 'Enter', altKey: true })
      )
      expect(combo.key).toBe('Enter')
      expect(combo.alt).toBe(true)
    })

    it('falls through to event.key for unmapped codes like Numpad', () => {
      const combo = KeyComboImpl.fromEvent(
        mockKeyEvent({ key: '1', code: 'Numpad1', ctrlKey: true })
      )
      expect(combo.key).toBe('1')
      expect(combo.ctrl).toBe(true)
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
