import { describe, expect, it } from 'vitest'

import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'

describe('useKeybindingStore', () => {
  it('should add and retrieve default keybindings', () => {
    const store = useKeybindingStore()
    const keybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'A', ctrl: true }
    })

    store.addDefaultKeybinding(keybinding)

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindings(keybinding.combo)).toEqual([keybinding])
  })

  it('should add and retrieve user keybindings', () => {
    const store = useKeybindingStore()
    const keybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'B', alt: true }
    })

    store.addUserKeybinding(keybinding)

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindings(keybinding.combo)).toEqual([keybinding])
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

  it('should override default keybindings with user keybindings', () => {
    const store = useKeybindingStore()
    const defaultKeybinding = new KeybindingImpl({
      commandId: 'test.command1',
      combo: { key: 'C', ctrl: true }
    })
    const userKeybinding = new KeybindingImpl({
      commandId: 'test.command2',
      combo: { key: 'C', ctrl: true }
    })

    store.addDefaultKeybinding(defaultKeybinding)
    store.addUserKeybinding(userKeybinding)

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindings(userKeybinding.combo)).toEqual([userKeybinding])
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
    expect(store.getKeybindings(userKeybinding.combo)).toEqual([userKeybinding])
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

  it('should allow adding duplicate user keybindings', () => {
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
    store.addUserKeybinding(keybinding2)

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindings(keybinding2.combo)).toEqual([keybinding2])
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
    expect(store.getKeybindings(defaultKeybinding.combo)).toEqual([
      defaultKeybinding
    ])
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
    expect(store.getKeybindings(keybinding.combo)).toEqual([keybinding])
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
    expect(store.getKeybindings(userNewKeybindings[0].combo)).toEqual([
      userNewKeybindings[0]
    ])

    for (const keybinding of userUnsetKeybindings) {
      store.unsetKeybinding(keybinding)
    }

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindings(userNewKeybindings[0].combo)).toEqual([
      userNewKeybindings[0]
    ])

    for (const keybinding of userNewKeybindings) {
      store.addUserKeybinding(keybinding)
    }

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindings(userNewKeybindings[0].combo)).toEqual([
      userNewKeybindings[0]
    ])
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

    store.updateSpecificKeybinding(oldKeybinding, newKeybinding)

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindings(newKeybinding.combo)[0]?.commandId).toBe(
      'command2'
    )
    expect(store.getKeybindingsByCommandId('command1')).toHaveLength(0)
  })

  it('should return false when no default or current keybinding exists during reset', () => {
    const store = useKeybindingStore()
    const result = store.resetKeybindingForCommand('nonexistent.command')
    expect(result).toBe(false)
  })

  it('should return false when current keybinding equals default keybinding', () => {
    const store = useKeybindingStore()
    const defaultKeybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'L', ctrl: true }
    })

    store.addDefaultKeybinding(defaultKeybinding)
    const result = store.resetKeybindingForCommand('test.command')

    expect(result).toBe(false)
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

    expect(result).toBe(true)
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
    store.updateSpecificKeybinding(defaultKeybinding, userKeybinding)

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindingByCommandId('test.command')).toEqual(
      userKeybinding
    )

    const result = store.resetKeybindingForCommand('test.command')

    expect(result).toBe(true)
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

    expect(
      store
        .getUserUnsetKeybindings()
        .some((binding) => binding.equals(defaultKeybinding))
    ).toBe(true)

    const result = store.resetKeybindingForCommand('test.command')

    expect(result).toBe(true)
    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybindingByCommandId('test.command')).toEqual(
      defaultKeybinding
    )

    expect(store.getUserUnsetKeybindings()).toHaveLength(0)
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

    expect(result).toBe(true)
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

      expect(result).toBe(true)
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

      expect(result).toBe(true)
      expect(store.getKeybindingsByCommandId('test.command')).toHaveLength(0)
    })
  })

  describe('dialog-scoped bindings on one combo', () => {
    const workspaceUndo = () =>
      new KeybindingImpl({
        commandId: 'test.undo',
        combo: { key: 'z', ctrl: true }
      })
    const maskEditorUndo = () =>
      new KeybindingImpl({
        commandId: 'test.maskEditor.undo',
        combo: { key: 'z', ctrl: true },
        dialogKey: 'global-mask-editor'
      })

    it('keeps a workspace default and a dialog-scoped default apart', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(workspaceUndo())
      store.addDefaultKeybinding(maskEditorUndo())

      expect(store.getKeybindings(workspaceUndo().combo)).toEqual([
        workspaceUndo()
      ])
      expect(
        store.getKeybindings(workspaceUndo().combo, 'global-mask-editor')
      ).toEqual([maskEditorUndo()])
    })

    it('rejects a default on the same combo and scope', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(maskEditorUndo())

      expect(() =>
        store.addDefaultKeybinding(
          new KeybindingImpl({
            commandId: 'test.other',
            combo: { key: 'z', ctrl: true },
            dialogKey: 'global-mask-editor'
          })
        )
      ).toThrow('already exists on test.maskEditor.undo')
    })

    it('only unsets the default a user binding shares a scope with', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(workspaceUndo())
      store.addDefaultKeybinding(maskEditorUndo())

      const userBinding = new KeybindingImpl({
        commandId: 'test.save',
        combo: { key: 'z', ctrl: true }
      })
      store.addUserKeybinding(userBinding)

      expect(store.getKeybindings(userBinding.combo)).toEqual([userBinding])
      expect(
        store.getKeybindings(userBinding.combo, 'global-mask-editor')
      ).toEqual([maskEditorUndo()])
      expect(store.getUserUnsetKeybindings()).toEqual([workspaceUndo()])
    })

    it('replaces only the user binding a new user binding shares a scope with', () => {
      const store = useKeybindingStore()
      store.addUserKeybinding(maskEditorUndo())
      const userBinding = new KeybindingImpl({
        commandId: 'test.save',
        combo: { key: 'z', ctrl: true }
      })
      store.addUserKeybinding(userBinding)
      const replacement = new KeybindingImpl({
        commandId: 'test.other',
        combo: { key: 'z', ctrl: true }
      })
      store.addUserKeybinding(replacement)

      expect(store.getUserKeybindings()).toEqual([
        maskEditorUndo(),
        replacement
      ])
    })

    it('drops the user binding that took a default’s place when the default is added back', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(workspaceUndo())
      store.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'test.save',
          combo: { key: 'z', ctrl: true }
        })
      )
      store.addUserKeybinding(workspaceUndo())

      expect(store.getUserKeybindings()).toEqual([])
      expect(store.getUserUnsetKeybindings()).toEqual([])
      expect(store.getKeybindings(workspaceUndo().combo)).toEqual([
        workspaceUndo()
      ])
    })

    it('prefers a user binding over a default registered after it', () => {
      const store = useKeybindingStore()
      const userBinding = new KeybindingImpl({
        commandId: 'test.save',
        combo: { key: 'z', ctrl: true }
      })
      store.addUserKeybinding(userBinding)
      store.addDefaultKeybinding(workspaceUndo())

      expect(store.getKeybindings(userBinding.combo)).toEqual([
        userBinding,
        workspaceUndo()
      ])
      expect(store.keybindings).toEqual([userBinding])
      expect(store.getKeybindingsByCommandId('test.undo')).toEqual([])
      expect(store.isCommandKeybindingModified('test.undo')).toBe(true)
    })

    it('collapses a default registered after an identical user binding', () => {
      const store = useKeybindingStore()
      store.addUserKeybinding(workspaceUndo())
      store.addDefaultKeybinding(workspaceUndo())

      expect(store.getUserKeybindings()).toEqual([])
      expect(store.keybindings).toEqual([workspaceUndo()])
      expect(store.isCommandKeybindingModified('test.undo')).toBe(false)
    })

    it('reclaims the combo when resetting a command whose default a user binding took', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(workspaceUndo())
      const userBinding = new KeybindingImpl({
        commandId: 'test.save',
        combo: { key: 'z', ctrl: true }
      })
      store.addUserKeybinding(userBinding)

      expect(store.resetKeybindingForCommand('test.undo')).toBe(true)
      expect(store.getKeybindingsByCommandId('test.save')).toEqual([])
      expect(store.getKeybindings(userBinding.combo)).toEqual([workspaceUndo()])
      expect(store.keybindings).toEqual([workspaceUndo()])
    })
  })

  describe('when clauses on one combo', () => {
    const sidebar = () =>
      new KeybindingImpl({ commandId: 'test.sidebar', combo: { key: 'w' } })
    const pan = () =>
      new KeybindingImpl({
        commandId: 'test.pan',
        combo: { key: 'w' },
        when: 'test.wasdMode'
      })

    it('keeps bindings with different clauses and tries the narrower first', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(sidebar())
      store.addDefaultKeybinding(pan())

      expect(store.getKeybindings(sidebar().combo)).toEqual([pan(), sidebar()])
      expect(store.keybindings).toEqual([sidebar(), pan()])
    })

    it('rejects a default with the same clause', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(pan())

      expect(() =>
        store.addDefaultKeybinding(
          new KeybindingImpl({
            commandId: 'test.other',
            combo: { key: 'w' },
            when: 'test.wasdMode'
          })
        )
      ).toThrow('already exists on test.pan')
    })

    it('treats differently spelled clauses as the same clause', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(
        new KeybindingImpl({
          commandId: 'test.a',
          combo: { key: 'w' },
          when: 'b && !a'
        })
      )
      const userBinding = new KeybindingImpl({
        commandId: 'test.b',
        combo: { key: 'w' },
        when: '!a && b'
      })
      store.addUserKeybinding(userBinding)

      expect(store.getKeybindings(userBinding.combo)).toEqual([userBinding])
      expect(store.getUserUnsetKeybindings()).toHaveLength(1)
    })
  })

  it('treats a binding that matches the default combo but not its scope as modified', () => {
    const store = useKeybindingStore()
    const defaultBinding = new KeybindingImpl({
      commandId: 'test.delete',
      combo: { key: 'Delete' },
      targetElementId: 'graph-canvas-container'
    })
    store.addDefaultKeybinding(defaultBinding)
    store.updateSpecificKeybinding(
      defaultBinding,
      new KeybindingImpl({ commandId: 'test.delete', combo: { key: 'Delete' } })
    )

    expect(store.isCommandKeybindingModified('test.delete')).toBe(true)
    expect(store.resetKeybindingForCommand('test.delete')).toBe(true)
    expect(store.getKeybindingByCommandId('test.delete')).toEqual(
      defaultBinding
    )
  })

  it('does not record a user binding identical to an active default', () => {
    const store = useKeybindingStore()
    const keybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'J', ctrl: true }
    })
    store.addDefaultKeybinding(keybinding)
    store.addUserKeybinding(keybinding)

    expect(store.getUserKeybindings()).toEqual([])
    expect(store.getUserUnsetKeybindings()).toEqual([])
    expect(store.isCurrentPresetModified).toBe(false)
  })
})
