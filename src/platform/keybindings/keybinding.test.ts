import { describe, expect, it } from 'vitest'

import { KeybindingImpl } from './keybinding'

describe('KeybindingImpl', () => {
  it('creates from Keybinding object', () => {
    const binding = new KeybindingImpl({
      commandId: 'save',
      combo: { key: 's', ctrl: true }
    })
    expect(binding.commandId).toBe('save')
    expect(binding.combo.key).toBe('s')
    expect(binding.combo.ctrl).toBe(true)
  })

  it('equals another KeybindingImpl with same values', () => {
    const a = new KeybindingImpl({
      commandId: 'save',
      combo: { key: 's', ctrl: true }
    })
    const b = new KeybindingImpl({
      commandId: 'save',
      combo: { key: 's', ctrl: true }
    })
    expect(a.equals(b)).toBe(true)
  })

  it('does not equal binding with different command', () => {
    const a = new KeybindingImpl({
      commandId: 'save',
      combo: { key: 's', ctrl: true }
    })
    const b = new KeybindingImpl({
      commandId: 'open',
      combo: { key: 's', ctrl: true }
    })
    expect(a.equals(b)).toBe(false)
  })

  it('does not equal binding with different targetElementId', () => {
    const a = new KeybindingImpl({
      commandId: 'save',
      combo: { key: 's', ctrl: true },
      targetElementId: 'canvas'
    })
    const b = new KeybindingImpl({
      commandId: 'save',
      combo: { key: 's', ctrl: true },
      targetElementId: 'sidebar'
    })
    expect(a.equals(b)).toBe(false)
  })

  it('does not equal non-KeybindingImpl objects', () => {
    const binding = new KeybindingImpl({
      commandId: 'save',
      combo: { key: 's', ctrl: true }
    })
    expect(binding.equals(null)).toBe(false)
    expect(binding.equals({ commandId: 'save' })).toBe(false)
  })
})
