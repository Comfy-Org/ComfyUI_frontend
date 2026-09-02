import { describe, expect, it } from 'vitest'

import { KeybindingImpl } from './keybinding'
import { useKeybindingStore } from './keybindingStore'

describe('explicit user shortcut choices', () => {
  const undo = () =>
    new KeybindingImpl({
      commandId: 'Comfy.Undo',
      combo: { key: 'z', ctrl: true }
    })
  const extensionUndo = () =>
    new KeybindingImpl({
      commandId: 'Example.Undo',
      combo: { key: 'z', ctrl: true }
    })

  it('reclaims the original default from an extension and can disable it', () => {
    const store = useKeybindingStore()
    const core = undo()
    store.addDefaultKeybinding(core)
    store.addExtensionKeybinding(extensionUndo(), 'Example')

    store.addUserKeybinding(core)

    const winner = store.getKeybindings(core.combo).at(0)
    expect(winner?.commandId).toBe('Comfy.Undo')
    expect(winner && store.sourceOf(winner)).toEqual({ tier: 'user' })
    expect(store.getUserKeybindings()).toEqual([core])

    store.removeAllKeybindingsForCommand('Comfy.Undo')
    expect(store.getKeybindings(core.combo)).toEqual([])
  })

  it('preserves the choice when defaults and extensions register later', () => {
    const store = useKeybindingStore()
    const core = undo()
    store.addUserKeybinding(core)
    store.addDefaultKeybinding(core)
    store.addExtensionKeybinding(extensionUndo(), 'Example')

    const winner = store.getKeybindings(core.combo).at(0)
    expect(winner?.commandId).toBe('Comfy.Undo')
    expect(winner && store.sourceOf(winner)).toEqual({ tier: 'user' })
    expect(store.getUserKeybindings()).toEqual([core])
  })
})
