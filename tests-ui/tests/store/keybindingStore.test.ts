import { setActivePinia, createPinia } from 'pinia'
import { useKeybindingStore, KeybindingImpl } from '@/stores/keybindingStore'

describe('useKeybindingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

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
    expect(store.getKeybinding(userKeybinding.combo)).toEqual(userKeybinding)
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
    expect(store.getKeybinding(keybinding2.combo)).toEqual(keybinding2)
  })

  it('should not throw an error when unsetting non-existent keybindings', () => {
    const store = useKeybindingStore()
    const keybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'H', alt: true, shift: true }
    })

    expect(() => store.unsetKeybinding(keybinding)).not.toThrow()
  })

  it('should remove unset keybinding when adding back a default keybinding', () => {
    const store = useKeybindingStore()
    const defaultKeybinding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'I', ctrl: true }
    })

    // Add default keybinding
    store.addDefaultKeybinding(defaultKeybinding)
    expect(store.keybindings).toHaveLength(1)

    // Unset the default keybinding
    store.unsetKeybinding(defaultKeybinding)
    expect(store.keybindings).toHaveLength(0)

    // Add the same keybinding as a user keybinding
    store.addUserKeybinding(defaultKeybinding)

    // Check that the keybinding is back and not in the unset list
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
    // Add default keybinding.
    // This can happen when we change default keybindings.
    store.addDefaultKeybinding(keybinding)
    // Add user keybinding.
    store.addUserKeybinding(keybinding)

    expect(store.keybindings).toHaveLength(1)
    expect(store.getKeybinding(keybinding.combo)).toEqual(keybinding)
  })

  it('Should keep previously customized keybindings after default keybindings change', () => {
    // Initially command 'foo' was bound to 'K, Ctrl'. User unset it and bound the
    // command to 'A, Ctrl'.
    // Now we change the default keybindings of 'foo' to 'A, Ctrl'.
    // The user customized keybinding should be kept.
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
})
