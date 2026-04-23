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

    it.each([
      { key: 'к', code: 'KeyR', expected: 'r', label: 'Russian R' },
      { key: 'س', code: 'KeyS', expected: 's', label: 'Arabic S' }
    ])(
      'resolves no-modifier $label to "$expected" (non-Latin layout)',
      ({ key, code, expected }) => {
        const combo = KeyComboImpl.fromEvent(mockKeyEvent({ key, code }))
        expect(combo.key).toBe(expected)
      }
    )

    it('resolves no-modifier punctuation from code', () => {
      const combo = KeyComboImpl.fromEvent(
        mockKeyEvent({ key: '.', code: 'Period' })
      )
      expect(combo.key).toBe('.')
    })

    it('resolves Shift+digit from code (Shift+1 → key="1", shift=true)', () => {
      const combo = KeyComboImpl.fromEvent(
        mockKeyEvent({ key: '!', code: 'Digit1', shiftKey: true })
      )
      expect(combo.key).toBe('1')
      expect(combo.shift).toBe(true)
    })

    it('resolves Ctrl+Alt US International accented char from code', () => {
      const combo = KeyComboImpl.fromEvent(
        mockKeyEvent({ key: 'á', code: 'KeyA', ctrlKey: true, altKey: true })
      )
      expect(combo.key).toBe('a')
      expect(combo.ctrl).toBe(true)
      expect(combo.alt).toBe(true)
    })

    it('falls through to event.key for unmapped codes like Numpad', () => {
      const combo = KeyComboImpl.fromEvent(
        mockKeyEvent({ key: '+', code: 'NumpadAdd' })
      )
      expect(combo.key).toBe('+')
    })

    it('falls through to event.key for special keys', () => {
      const combo = KeyComboImpl.fromEvent(
        mockKeyEvent({ key: 'Enter', code: 'Enter' })
      )
      expect(combo.key).toBe('Enter')
    })

    it('falls through to event.key when code is empty', () => {
      const combo = KeyComboImpl.fromEvent(mockKeyEvent({ key: 'a', code: '' }))
      expect(combo.key).toBe('a')
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
