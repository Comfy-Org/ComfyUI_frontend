import { afterEach, describe, expect, it } from 'vitest'

import {
  clearKeybindingGates,
  isKeybindingAllowed,
  registerKeybindingGate
} from './keybindingGate'

describe('keybindingGate', () => {
  afterEach(() => {
    clearKeybindingGates()
  })

  it('allows every command when nothing is registered', () => {
    expect(isKeybindingAllowed('Comfy.Undo')).toBe(true)
  })

  it('blocks only the commands a gate refuses', () => {
    registerKeybindingGate((commandId) => commandId !== 'Comfy.Undo')

    expect(isKeybindingAllowed('Comfy.Undo')).toBe(false)
    expect(isKeybindingAllowed('Comfy.ShowSettingsDialog')).toBe(true)
  })

  it('blocks a command when any one gate refuses it', () => {
    registerKeybindingGate(() => true)
    registerKeybindingGate((commandId) => commandId !== 'Comfy.Redo')

    expect(isKeybindingAllowed('Comfy.Redo')).toBe(false)
  })

  it('stops consulting a gate once it is unregistered', () => {
    const unregister = registerKeybindingGate(() => false)
    expect(isKeybindingAllowed('Comfy.Undo')).toBe(false)

    unregister()

    expect(isKeybindingAllowed('Comfy.Undo')).toBe(true)
  })
})
