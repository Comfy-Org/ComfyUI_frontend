import { describe, expect, it } from 'vitest'

import { KeyComboImpl } from './keyCombo'

describe('KeyComboImpl', () => {
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
