import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  KeyComboImpl,
  KeybindingImpl,
  useKeybindingStore
} from '@/stores/keybindingStore'

describe('useKeybindingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  const keybindingA = new KeybindingImpl({
    commandId: 'a',
    combo: { key: 'a', code: 'KeyA', ctrl: true }
  })
  const keybindingB = new KeybindingImpl({
    commandId: 'b',
    combo: { key: 'b', code: 'KeyB', ctrl: true }
  })

  describe('add keybinding', () => {
    it('should add and retrieve default keybindings', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(keybindingA)
      store.addDefaultKeybinding(keybindingB)
      expect(store.keybindings).toEqual([keybindingA, keybindingB])
    })

    it('should add and retrieve user keybindings', () => {
      const store = useKeybindingStore()
      store.addUserKeybinding(keybindingA)
      store.addUserKeybinding(keybindingB)
      expect(store.getUserKeybindings()).toEqual({
        [keybindingA.combo.serialize()]: keybindingA,
        [keybindingB.combo.serialize()]: keybindingB
      })
    })

    it('should allow user keybindings to override default keybindings', () => {
      const store = useKeybindingStore()
      const defaultKeybinding = new KeybindingImpl({
        commandId: 'default',
        combo: { key: 'a', code: 'KeyA', ctrl: true }
      })
      const userKeybinding = new KeybindingImpl({
        commandId: 'user',
        combo: { key: 'a', code: 'KeyA', ctrl: true }
      })
      store.addDefaultKeybinding(defaultKeybinding)
      store.addUserKeybinding(userKeybinding)
      expect(store.getKeybinding(userKeybinding.combo)).toEqual(userKeybinding)
    })
  })

  describe('unset keybinding', () => {
    it('should unset a user keybinding', () => {
      const store = useKeybindingStore()
      store.addUserKeybinding(keybindingA)
      store.unsetKeybinding(keybindingA)
      expect(store.getUserKeybindings()).toEqual({})
    })

    it('should unset a default keybinding', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(keybindingA)
      store.unsetKeybinding(keybindingA)
      expect(store.keybindings).toEqual([])
      expect(store.getUserUnsetKeybindings()).toEqual({
        [keybindingA.combo.serialize()]: keybindingA
      })
    })

    it('should warn when unsetting a non-existent keybinding', () => {
      const store = useKeybindingStore()
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      store.unsetKeybinding(keybindingA)
      expect(spy).toHaveBeenCalledWith(
        'Trying to unset non-exist keybinding: {"commandId":"a","combo":{"key":"a","code":"KeyA","ctrl":true,"alt":false,"shift":false}}'
      )
      spy.mockRestore()
    })
  })

  describe('Keybindings on multiple commands', () => {
    it('should get keybindings by commandId', () => {
      const store = useKeybindingStore()
      const keybindingA2 = new KeybindingImpl({
        commandId: 'a',
        combo: { key: 'b', code: 'KeyB', alt: true }
      })
      store.addDefaultKeybinding(keybindingA)
      store.addDefaultKeybinding(keybindingA2)
      expect(store.getKeybindingsByCommandId('a')).toEqual([
        keybindingA,
        keybindingA2
      ])
    })
  })

  describe('meta key', () => {
    it('should treat meta key as ctrl key', () => {
      const keyCombo = new KeyComboImpl({
        key: 'a',
        code: 'KeyA',
        ctrl: false,
        alt: false,
        shift: false
      })
      const keyComboCtrl = new KeyComboImpl({
        key: 'a',
        code: 'KeyA',
        ctrl: true,
        alt: false,
        shift: false
      })
      const event = {
        key: 'a',
        code: 'KeyA',
        metaKey: true
      } as KeyboardEvent
      expect(KeyComboImpl.fromEvent(event).equals(keyComboCtrl)).toBe(true)
      expect(keyCombo.ctrl).toBe(false)
    })
  })

  describe('Keybinding with complex modifiers', () => {
    it('should handle keybindings with multiple modifiers', () => {
      const store = useKeybindingStore()
      const complexKeybinding = new KeybindingImpl({
        commandId: 'complex',
        combo: { key: 'a', code: 'KeyA', ctrl: true, alt: true }
      })
      store.addDefaultKeybinding(complexKeybinding)
      expect(store.getKeybinding(complexKeybinding.combo)).toEqual(
        complexKeybinding
      )
    })
  })

  describe('Serialization', () => {
    it('should serialize and deserialize keybindings correctly', () => {
      const originalKeybinding = new KeybindingImpl({
        commandId: 'test',
        combo: { key: 'a', code: 'KeyA', shift: true }
      })
      const serialized = originalKeybinding.combo.serialize()
      expect(serialized).toBe('KeyA:false:false:true')
    })
  })

  describe('update keybinding', () => {
    it('should update keybinding', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(keybindingA)
      store.updateKeybindingOnCommand(
        new KeybindingImpl({
          commandId: 'a',
          combo: { key: 'b', code: 'KeyB', ctrl: true }
        })
      )
      expect(store.getKeybindingsByCommandId('a')).toEqual([
        new KeybindingImpl({
          commandId: 'a',
          combo: { key: 'b', code: 'KeyB', ctrl: true }
        })
      ])
    })

    it('should unset old keybinding', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(keybindingA)
      store.updateKeybindingOnCommand(
        new KeybindingImpl({
          commandId: 'a',
          combo: { key: 'b', code: 'KeyB', ctrl: true }
        })
      )
      expect(store.getKeybinding(keybindingA.combo)).toBeUndefined()
    })
  })

  describe('reset keybinding', () => {
    it('should reset a modified keybinding to its default', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(keybindingA)
      // Modify the keybinding
      store.updateKeybindingOnCommand(
        new KeybindingImpl({
          commandId: 'a',
          combo: { key: 'b', code: 'KeyB', ctrl: true }
        })
      )
      // Reset the keybinding
      store.resetKeybindingForCommand('a')
      expect(store.getKeybindingByCommandId('a')).toEqual(keybindingA)
    })

    it('should re-enable a default keybinding that was unset', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(keybindingA)
      // Unset the default keybinding
      store.unsetKeybinding(keybindingA)
      // Reset the keybinding
      store.resetKeybindingForCommand('a')
      expect(store.getKeybindingByCommandId('a')).toEqual(keybindingA)
    })

    it('should remove a user-added keybinding that has no default', () => {
      const store = useKeybindingStore()
      store.addUserKeybinding(keybindingA)
      store.resetKeybindingForCommand('a')
      expect(store.getKeybindingByCommandId('a')).toBeUndefined()
    })
  })

  describe('isCommandKeybindingModified', () => {
    it('should return true for a modified keybinding', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(keybindingA)
      store.updateKeybindingOnCommand(
        new KeybindingImpl({
          commandId: 'a',
          combo: { key: 'b', code: 'KeyB', ctrl: true }
        })
      )
      expect(store.isCommandKeybindingModified('a')).toBe(true)
    })

    it('should return false for an unmodified keybinding', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(keybindingA)
      expect(store.isCommandKeybindingModified('a')).toBe(false)
    })

    it('should return true for an unset default keybinding', () => {
      const store = useKeybindingStore()
      store.addDefaultKeybinding(keybindingA)
      store.unsetKeybinding(keybindingA)
      expect(store.isCommandKeybindingModified('a')).toBe(true)
    })

    it('should return true for a user-added keybinding with no default', () => {
      const store = useKeybindingStore()
      store.addUserKeybinding(keybindingA)
      expect(store.isCommandKeybindingModified('a')).toBe(true)
    })
  })
})

describe('Keybinding Store - Layout Independence', () => {
  it('should treat the same physical key as equal regardless of keyboard layout', () => {
    // Simulate pressing the 'S' key on a US keyboard
    const eventEn = {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent

    // Simulate pressing the same physical key on a Russian keyboard, which produces 'ы'
    const eventRu = {
      key: 'ы',
      code: 'KeyS', // The physical key code remains the same
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent

    const comboEn = KeyComboImpl.fromEvent(eventEn)
    const comboRu = KeyComboImpl.fromEvent(eventRu)

    // 1. Check if the 'code' is correctly captured
    expect(comboEn.code).toBe('KeyS')
    expect(comboRu.code).toBe('KeyS')

    // 2. Check if they are considered equal for matching
    expect(comboEn.equals(comboRu)).toBe(true)

    // 3. Check if they produce the same serialization for matching
    expect(comboEn.serialize()).toBe(comboRu.serialize())
    expect(comboEn.serialize()).toBe('KeyS:true:false:false')

    // 4. Check display string (which should be different and locale-aware)
    expect(comboEn.toString()).toBe('Ctrl + s')
    expect(comboRu.toString()).toBe('Ctrl + ы')
  })

  it('should differentiate between different physical keys', () => {
    // Simulate pressing 'S'
    const eventS = {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent

    // Simulate pressing 'A'
    const eventA = {
      key: 'a',
      code: 'KeyA',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false
    } as KeyboardEvent

    const comboS = KeyComboImpl.fromEvent(eventS)
    const comboA = KeyComboImpl.fromEvent(eventA)

    expect(comboS.equals(comboA)).toBe(false)
    expect(comboS.serialize()).not.toBe(comboA.serialize())
  })
})
