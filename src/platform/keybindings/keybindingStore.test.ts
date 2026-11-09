import { describe, expect, it } from 'vitest'

import { KeybindingImpl } from '@comfyorg/keybindings/keybinding'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'

describe('useKeybindingStore', () => {
  it('should add and retrieve default keybindings', () => {
    const store = useKeybindingStore()
    const keybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'A', ctrl: true }
    })

    store.addDefaultKeybinding(keybinding)

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybinding(keybinding.combo)).toEqual(keybinding)
  })

  it('should add and retrieve user keybindings', () => {
    const store = useKeybindingStore()
    const keybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'B', alt: true }
    })

    store.addUserKeybinding(keybinding)

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybinding(keybinding.combo)).toEqual(keybinding)
  })

  it('should get keybindings by command id', () => {
    const store = useKeybindingStore()
    const keybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'C', ctrl: true }
    })
    store.addDefaultKeybinding(keybinding)
    expect(store.getKeybindingsByCommandId('test.command')).toEqual([
      keybinding
    ])
  })

  it('should replace a default keybinding when replacement is explicit', () => {
    const store = useKeybindingStore()
    const defaultKeybinding = new KeybindingImpl({
      commandId: 'test.command1',
      combo: { key: 'C', ctrl: true }
    })
    const unrelatedKeybinding = new KeybindingImpl({
      commandId: 'test.unrelated',
      combo: { key: 'U', ctrl: true }
    })
    const userKeybinding = new KeybindingImpl({
      commandId: 'test.command2',
      combo: { key: 'C', ctrl: true }
    })

    store.addDefaultKeybinding(defaultKeybinding)
    store.addDefaultKeybinding(unrelatedKeybinding)
    const result = store.addUserKeybinding(userKeybinding, {
      replaceConflicts: true
    })

    expect(result).toEqual({ ok: true, changed: true })
    expect(store.getKeybinding(userKeybinding.combo)).toEqual(userKeybinding)
    expect(store.getKeybindingsByCommandId('test.command1')).toEqual([])
    expect(store.getKeybinding(unrelatedKeybinding.combo)).toEqual(
      unrelatedKeybinding
    )
  })

  describe('writes that claim an occupied combo without explicit replacement', () => {
    function holderOnCtrlC() {
      return new KeybindingImpl({
        commandId: 'test.holder',
        combo: { key: 'C', ctrl: true }
      })
    }
    function incomingOnCtrlC() {
      return new KeybindingImpl({
        commandId: 'test.incoming',
        combo: { key: 'C', ctrl: true }
      })
    }

    it.for([
      {
        name: 'a default holds the combo',
        hold: (holder: KeybindingImpl) =>
          useKeybindingStore().addDefaultKeybinding(holder)
      },
      {
        name: 'a user binding holds the combo',
        hold: (holder: KeybindingImpl) =>
          useKeybindingStore().addUserKeybinding(holder)
      }
    ])('refuses an added binding when $name', ({ hold }) => {
      const store = useKeybindingStore()
      const holder = holderOnCtrlC()
      const incoming = incomingOnCtrlC()
      hold(holder)

      const result = store.addUserKeybinding(incoming)

      expect(result).toEqual({
        ok: false,
        reason: 'conflict',
        conflict: { existing: holder, incoming }
      })
      expect(store.getKeybinding(holder.combo)).toEqual(holder)
      expect(store.getKeybindingsByCommandId('test.incoming')).toEqual([])
    })

    it('keeps the old binding when moving a specific binding is refused', () => {
      const store = useKeybindingStore()
      const holder = holderOnCtrlC()
      const original = new KeybindingImpl({
        commandId: 'test.incoming',
        combo: { key: 'D', ctrl: true }
      })
      store.addDefaultKeybinding(holder)
      store.addDefaultKeybinding(original)

      const result = store.updateSpecificKeybinding(original, incomingOnCtrlC())

      expect(result.ok).toBe(false)
      expect(store.getKeybinding(original.combo)).toEqual(original)
      expect(store.getKeybinding(holder.combo)).toEqual(holder)
      expect(store.getUserUnsetKeybindingValues()).toEqual([])
    })

    it('keeps the current binding when changing a command binding is refused', () => {
      const store = useKeybindingStore()
      const holder = holderOnCtrlC()
      const original = new KeybindingImpl({
        commandId: 'test.incoming',
        combo: { key: 'D', ctrl: true }
      })
      store.addDefaultKeybinding(holder)
      store.addUserKeybinding(original)

      const result = store.updateKeybindingOnCommand(incomingOnCtrlC())

      expect(result.ok).toBe(false)
      expect(store.getKeybinding(original.combo)).toEqual(original)
      expect(store.getKeybinding(holder.combo)).toEqual(holder)
    })
  })

  describe('applySavedChoices', () => {
    it('leaves the live keymap unchanged when a later entry conflicts', () => {
      const store = useKeybindingStore()
      const live = new KeybindingImpl({
        commandId: 'test.live',
        combo: { key: 'L', ctrl: true }
      })
      store.addUserKeybinding(live)

      const result = store.applySavedChoices({
        unsetBindings: [],
        newBindings: [
          new KeybindingImpl({
            commandId: 'test.first',
            combo: { key: 'F', ctrl: true }
          }),
          new KeybindingImpl({
            commandId: 'test.second',
            combo: { key: 'F', ctrl: true }
          })
        ]
      })

      expect(result.ok).toBe(false)
      expect(store.getUserKeybindingValues()).toEqual([live])
      expect(store.getKeybindingsByCommandId('test.first')).toEqual([])
    })

    it('lets a saved choice keep a combo a default also claims', () => {
      const store = useKeybindingStore()
      const proposed = new KeybindingImpl({
        commandId: 'test.default',
        combo: { key: 'K', ctrl: true }
      })
      const saved = new KeybindingImpl({
        commandId: 'test.saved',
        combo: { key: 'K', ctrl: true }
      })
      store.addDefaultKeybinding(proposed)

      const result = store.applySavedChoices({
        unsetBindings: [],
        newBindings: [saved]
      })

      expect(result).toEqual({ ok: true, changed: true })
      expect(store.getKeybinding(saved.combo)).toEqual(saved)
    })

    it('replaces every earlier user choice', () => {
      const store = useKeybindingStore()
      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'test.previous',
          combo: { key: 'P', ctrl: true }
        })
      )
      const saved = new KeybindingImpl({
        commandId: 'test.saved',
        combo: { key: 'S', ctrl: true }
      })

      store.applySavedChoices({ unsetBindings: [], newBindings: [saved] })

      expect(store.getUserKeybindingValues()).toEqual([saved])
    })
  })

  describe('resetKeybindingForCommand with an occupied default combo', () => {
    it('refuses and keeps both bindings when another command holds the combo', () => {
      const store = useKeybindingStore()
      const defaultBinding = new KeybindingImpl({
        commandId: 'test.default',
        combo: { key: 'R', ctrl: true }
      })
      const overwriting = new KeybindingImpl({
        commandId: 'test.overwriting',
        combo: { key: 'R', ctrl: true }
      })
      store.addDefaultKeybinding(defaultBinding)
      store.addUserKeybinding(overwriting, { replaceConflicts: true })

      const result = store.resetKeybindingForCommand('test.default')

      expect(result).toEqual({
        ok: false,
        reason: 'conflict',
        conflict: { existing: overwriting, incoming: defaultBinding }
      })
      expect(store.getKeybinding(overwriting.combo)).toEqual(overwriting)
      expect(store.getUserUnsetKeybindingValues()).toEqual([defaultBinding])
    })
  })

  it('Should allow binding to unsetted default keybindings', () => {
    const store = useKeybindingStore()
    const defaultKeybinding = new KeybindingImpl({
      commandId: 'test.command1',
      combo: { key: 'C', ctrl: true }
    })
    store.addDefaultKeybinding(defaultKeybinding)
    store.unsetKeybinding(defaultKeybinding)

    const userKeybinding = new KeybindingImpl({
      commandId: 'test.command2',
      combo: { key: 'C', ctrl: true }
    })
    store.addUserKeybinding(userKeybinding)

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybinding(userKeybinding.combo)).toEqual(userKeybinding)
  })

  it('should unset user keybindings', () => {
    const store = useKeybindingStore()
    const keybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'D', meta: true }
    })

    store.addUserKeybinding(keybinding)
    expect(store.keybindings).toHaveLength(1)

    store.unsetKeybinding(keybinding)
    expect(store.keybindings).toHaveLength(0)
  })

  it('should unset default keybindings', () => {
    const store = useKeybindingStore()
    const keybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'E', ctrl: true, alt: true }
    })

    store.addDefaultKeybinding(keybinding)
    expect(store.keybindings).toHaveLength(1)

    store.unsetKeybinding(keybinding)
    expect(store.keybindings).toHaveLength(0)
  })

  it('should throw an error when adding duplicate default keybindings', () => {
    const store = useKeybindingStore()
    const keybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'F', shift: true }
    })

    store.addDefaultKeybinding(keybinding)
    expect(() => store.addDefaultKeybinding(keybinding)).toThrow()
  })

  it('should replace a user keybinding when replacement is explicit', () => {
    const store = useKeybindingStore()
    const keybinding1 = new KeybindingImpl({
      commandId: 'test.command1',
      combo: { key: 'G', ctrl: true }
    })
    const keybinding2 = new KeybindingImpl({
      commandId: 'test.command2',
      combo: { key: 'G', ctrl: true }
    })

    store.addUserKeybinding(keybinding1)
    store.addUserKeybinding(keybinding2, { replaceConflicts: true })

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybinding(keybinding2.combo)).toEqual(keybinding2)
  })

  it('takes a combo back from its holder when explicitly moving a command onto its own unset default', () => {
    const store = useKeybindingStore()
    const combo = { key: 'S', ctrl: true }
    const defaultBinding = new KeybindingImpl({
      commandId: 'test.save',
      combo
    })
    const holder = new KeybindingImpl({ commandId: 'test.rename', combo })
    const customBinding = new KeybindingImpl({
      commandId: 'test.save',
      combo: { key: 'X', ctrl: true, shift: true }
    })
    store.addDefaultKeybinding(defaultBinding)
    store.addUserKeybinding(holder, { replaceConflicts: true })
    store.addUserKeybinding(customBinding)

    const moved = store.updateSpecificKeybinding(
      customBinding,
      defaultBinding,
      { replaceConflicts: true }
    )

    expect(moved).toEqual({ ok: true, changed: true })
    expect(store.getKeybinding(defaultBinding.combo)).toEqual(defaultBinding)
    expect(store.getKeybindingsByCommandId('test.rename')).toEqual([])
    expect(store.getKeybindingsByCommandId('test.save')).toEqual([
      defaultBinding
    ])
  })

  it('should not throw an error when unsetting non-existent keybindings', () => {
    const store = useKeybindingStore()
    const keybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'H', alt: true, shift: true }
    })

    expect(() => store.unsetKeybinding(keybinding)).not.toThrow()
  })

  it('should not throw an error when unsetting unknown keybinding', () => {
    const store = useKeybindingStore()
    const keybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'I', ctrl: true }
    })
    store.addUserKeybinding(keybinding)

    expect(() =>
      store.unsetKeybinding(
        new KeybindingImpl({
          commandId: 'test.foo',
          combo: { key: 'I', ctrl: true }
        })
      )
    ).not.toThrow()
  })

  it('should remove unset keybinding when adding back a default keybinding', () => {
    const store = useKeybindingStore()
    const defaultKeybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'I', ctrl: true }
    })

    store.addDefaultKeybinding(defaultKeybinding)
    expect(store.keybindings).toHaveLength(1)

    store.unsetKeybinding(defaultKeybinding)
    expect(store.keybindings).toHaveLength(0)

    store.addUserKeybinding(defaultKeybinding)

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybinding(defaultKeybinding.combo)).toEqual(
      defaultKeybinding
    )
  })

  it('Should accept same keybinding from default and user', () => {
    const store = useKeybindingStore()
    const keybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'J', ctrl: true }
    })
    store.addDefaultKeybinding(keybinding)
    store.addUserKeybinding(keybinding)

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybinding(keybinding.combo)).toEqual(keybinding)
  })

  it('Should keep previously customized keybindings after default keybindings change', () => {
    const store = useKeybindingStore()

    const userUnsetKeybindings = [
      new KeybindingImpl({
        commandId: 'foo',
        combo: { key: 'K', ctrl: true }
      })
    ]

    const userNewKeybindings = [
      new KeybindingImpl({
        commandId: 'foo',
        combo: { key: 'A', ctrl: true }
      })
    ]

    const newCoreKeybindings = [
      new KeybindingImpl({
        commandId: 'foo',
        combo: { key: 'A', ctrl: true }
      })
    ]

    for (const keybinding of newCoreKeybindings) {
      store.addDefaultKeybinding(keybinding)
    }

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybinding(userNewKeybindings[0].combo)).toEqual(
      userNewKeybindings[0]
    )

    for (const keybinding of userUnsetKeybindings) {
      store.unsetKeybinding(keybinding)
    }

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybinding(userNewKeybindings[0].combo)).toEqual(
      userNewKeybindings[0]
    )

    for (const keybinding of userNewKeybindings) {
      store.addUserKeybinding(keybinding)
    }

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybinding(userNewKeybindings[0].combo)).toEqual(
      userNewKeybindings[0]
    )
  })

  it('should replace the previous keybinding with a new one for the same combo and unset the old command', () => {
    const store = useKeybindingStore()

    const oldKeybinding = new KeybindingImpl({
      commandId: 'command1',
      combo: { key: 'A', ctrl: true }
    })

    store.addUserKeybinding(oldKeybinding)

    const newKeybinding = new KeybindingImpl({
      commandId: 'command2',
      combo: { key: 'A', ctrl: true }
    })

    store.updateKeybindingOnCommand(newKeybinding, { replaceConflicts: true })

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybinding(newKeybinding.combo)).toMatchObject({
      commandId: 'command2'
    })
    expect(store.getKeybindingsByCommandId('command1')).toHaveLength(0)
  })

  it('should return false when no default or current keybinding exists during reset', () => {
    const store = useKeybindingStore()
    const result = store.resetKeybindingForCommand('nonexistent.command')
    expect(result).toEqual({ ok: true, changed: false })
  })

  it('should return false when current keybinding equals default keybinding', () => {
    const store = useKeybindingStore()
    const defaultKeybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'L', ctrl: true }
    })

    store.addDefaultKeybinding(defaultKeybinding)
    const result = store.resetKeybindingForCommand('test.command')

    expect(result).toEqual({ ok: true, changed: false })
    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindingByCommandId('test.command')).toEqual(
      defaultKeybinding
    )
  })

  it('should unset user keybinding when no default keybinding exists and return true', () => {
    const store = useKeybindingStore()
    const userKeybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'M', ctrl: true }
    })

    store.addUserKeybinding(userKeybinding)
    expect(store.keybindings).toHaveLength(1)

    const result = store.resetKeybindingForCommand('test.command')

    expect(result).toEqual({ ok: true, changed: true })
    expect(store.keybindings).toHaveLength(0)
  })

  it('should restore default keybinding when user has overridden it and return true', () => {
    const store = useKeybindingStore()

    const defaultKeybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'N', ctrl: true }
    })

    const userKeybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'O', alt: true }
    })

    store.addDefaultKeybinding(defaultKeybinding)
    store.updateKeybindingOnCommand(userKeybinding)

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindingByCommandId('test.command')).toEqual(
      userKeybinding
    )

    const result = store.resetKeybindingForCommand('test.command')

    expect(result).toEqual({ ok: true, changed: true })
    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindingByCommandId('test.command')).toEqual(
      defaultKeybinding
    )
  })

  it('should remove unset record and restore default keybinding when user has unset it', () => {
    const store = useKeybindingStore()

    const defaultKeybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'P', ctrl: true }
    })

    store.addDefaultKeybinding(defaultKeybinding)

    store.unsetKeybinding(defaultKeybinding)
    expect(store.keybindings).toHaveLength(0)

    const serializedCombo = defaultKeybinding.combo.serialize()
    const userUnsetKeybindings = store.getUserUnsetKeybindings()
    expect(userUnsetKeybindings[serializedCombo]).toEqual(defaultKeybinding)

    const result = store.resetKeybindingForCommand('test.command')

    expect(result).toEqual({ ok: true, changed: true })
    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindingByCommandId('test.command')).toEqual(
      defaultKeybinding
    )

    expect(store.getUserUnsetKeybindings()[serializedCombo]).toBeUndefined()
  })

  it('should handle complex scenario with both unset and user keybindings', () => {
    const store = useKeybindingStore()

    const defaultKeybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'Q', ctrl: true }
    })
    store.addDefaultKeybinding(defaultKeybinding)

    store.unsetKeybinding(defaultKeybinding)
    expect(store.keybindings).toHaveLength(0)

    const userKeybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'R', alt: true }
    })
    store.addUserKeybinding(userKeybinding)
    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindingByCommandId('test.command')).toEqual(
      userKeybinding
    )

    const result = store.resetKeybindingForCommand('test.command')

    expect(result).toEqual({ ok: true, changed: true })
    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindingByCommandId('test.command')).toEqual(
      defaultKeybinding
    )
  })

  describe('removeAllKeybindingsForCommand', () => {
    it('should return false when command has no bindings', () => {
      const store = useKeybindingStore()
      expect(store.removeAllKeybindingsForCommand('nonexistent.command')).toBe(
        false
      )
    })

    it('should remove all bindings for a command with multiple bindings', () => {
      const store = useKeybindingStore()
      const binding1 = new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'A', ctrl: true }
      })
      const binding2 = new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'B', ctrl: true }
      })

      store.addDefaultKeybinding(binding1)
      store.addUserKeybinding(binding2)
      expect(store.getKeybindingsByCommandId('test.command')).toHaveLength(2)

      const result = store.removeAllKeybindingsForCommand('test.command')

      expect(result).toBe(true)
      expect(store.getKeybindingsByCommandId('test.command')).toHaveLength(0)
    })
  })

  describe('updateSpecificKeybinding', () => {
    it('should replace a specific binding with a new one', () => {
      const store = useKeybindingStore()
      const binding1 = new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'A', ctrl: true }
      })
      const binding2 = new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'B', ctrl: true }
      })

      store.addUserKeybinding(binding1)
      store.addUserKeybinding(binding2)
      expect(store.getKeybindingsByCommandId('test.command')).toHaveLength(2)

      const newBinding = new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'C', alt: true }
      })
      store.updateSpecificKeybinding(binding1, newBinding)

      const bindings = store.getKeybindingsByCommandId('test.command')
      expect(bindings).toHaveLength(2)
      expect(bindings.some((b) => b.combo.equals(newBinding.combo))).toBe(true)
      expect(bindings.some((b) => b.combo.equals(binding1.combo))).toBe(false)
    })
  })

  describe('isCommandKeybindingModified (multi-binding)', () => {
    it('should detect modification when binding count differs', () => {
      const store = useKeybindingStore()
      const defaultBinding = new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'A', ctrl: true }
      })
      store.addDefaultKeybinding(defaultBinding)

      const extraBinding = new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'B', ctrl: true }
      })
      store.addUserKeybinding(extraBinding)

      expect(store.isCommandKeybindingModified('test.command')).toBe(true)
    })

    it('should return false when multi-binding matches defaults', () => {
      const store = useKeybindingStore()
      const binding1 = new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'A', ctrl: true }
      })
      const binding2 = new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'B', ctrl: true }
      })

      store.addDefaultKeybinding(binding1)
      store.addDefaultKeybinding(binding2)

      expect(store.isCommandKeybindingModified('test.command')).toBe(false)
    })
  })

  describe('resetKeybindingForCommand (multi-binding)', () => {
    it('should restore all default bindings when user has modified multi-binding command', () => {
      const store = useKeybindingStore()
      const defaultBinding1 = new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'Delete' }
      })
      const defaultBinding2 = new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'Backspace' }
      })

      store.addDefaultKeybinding(defaultBinding1)
      store.addDefaultKeybinding(defaultBinding2)
      expect(store.getKeybindingsByCommandId('test.command')).toHaveLength(2)

      store.unsetKeybinding(defaultBinding1)
      expect(store.getKeybindingsByCommandId('test.command')).toHaveLength(1)

      const result = store.resetKeybindingForCommand('test.command')

      expect(result).toEqual({ ok: true, changed: true })
      expect(store.getKeybindingsByCommandId('test.command')).toHaveLength(2)
    })

    it('should remove all user bindings when no defaults exist for multi-binding', () => {
      const store = useKeybindingStore()
      const userBinding1 = new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'X', ctrl: true }
      })
      const userBinding2 = new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'Y', ctrl: true }
      })

      store.addUserKeybinding(userBinding1)
      store.addUserKeybinding(userBinding2)
      expect(store.getKeybindingsByCommandId('test.command')).toHaveLength(2)

      const result = store.resetKeybindingForCommand('test.command')

      expect(result).toEqual({ ok: true, changed: true })
      expect(store.getKeybindingsByCommandId('test.command')).toHaveLength(0)
    })
  })
})
