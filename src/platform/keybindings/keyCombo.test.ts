import { describe, expect, it } from 'vitest'

import { KeyComboImpl } from './keyCombo'

describe('KeyComboImpl', () => {
  it('creates from KeyCombo object with defaults', () => {
    const combo = new KeyComboImpl({ key: 'a' })
    expect(combo.key).toBe('a')
    expect(combo.ctrl).toBe(false)
    expect(combo.alt).toBe(false)
    expect(combo.shift).toBe(false)
  })

  it('serializes to deterministic string', () => {
    const combo = new KeyComboImpl({ key: 's', ctrl: true })
    expect(combo.serialize()).toBe('S:true:false:false')
  })

  it('renders human-readable toString', () => {
    const combo = new KeyComboImpl({ key: 's', ctrl: true, shift: true })
    expect(combo.toString()).toBe('Ctrl + Shift + s')
  })

  it('equals another KeyComboImpl (case-insensitive key)', () => {
    const a = new KeyComboImpl({ key: 'A', ctrl: true })
    const b = new KeyComboImpl({ key: 'a', ctrl: true })
    expect(a.equals(b)).toBe(true)
  })

  it('does not equal different combos', () => {
    const a = new KeyComboImpl({ key: 'a', ctrl: true })
    const b = new KeyComboImpl({ key: 'a', alt: true })
    expect(a.equals(b)).toBe(false)
  })

  it('does not equal non-KeyComboImpl objects', () => {
    const combo = new KeyComboImpl({ key: 'a' })
    expect(combo.equals({ key: 'a' })).toBe(false)
    expect(combo.equals(null)).toBe(false)
  })

  it('detects modifier presence', () => {
    expect(new KeyComboImpl({ key: 'a' }).hasModifier).toBe(false)
    expect(new KeyComboImpl({ key: 'a', ctrl: true }).hasModifier).toBe(true)
    expect(new KeyComboImpl({ key: 'a', alt: true }).hasModifier).toBe(true)
    expect(new KeyComboImpl({ key: 'a', shift: true }).hasModifier).toBe(true)
  })

  it('detects modifier keys', () => {
    expect(new KeyComboImpl({ key: 'Control' }).isModifier).toBe(true)
    expect(new KeyComboImpl({ key: 'a' }).isModifier).toBe(false)
  })

  it('counts modifiers', () => {
    expect(
      new KeyComboImpl({ key: 'a', ctrl: true, shift: true }).modifierCount
    ).toBe(2)
  })

  it('detects shift-only combos', () => {
    expect(new KeyComboImpl({ key: 'a', shift: true }).isShiftOnly).toBe(true)
    expect(
      new KeyComboImpl({ key: 'a', shift: true, ctrl: true }).isShiftOnly
    ).toBe(false)
  })

  it('creates from keyboard event', () => {
    const event = {
      key: 'z',
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false
    } as KeyboardEvent

    const combo = KeyComboImpl.fromEvent(event)
    expect(combo.key).toBe('z')
    expect(combo.ctrl).toBe(true)
  })
})
