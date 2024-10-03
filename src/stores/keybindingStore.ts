import { defineStore } from 'pinia'
import { computed, Ref, ref, toRaw } from 'vue'
import { Keybinding, KeyCombo } from '@/types/keyBindingTypes'
import { useSettingStore } from './settingStore'
import { CORE_KEYBINDINGS } from './coreKeybindings'
import type { ComfyExtension } from '@/types/comfy'

export class KeybindingImpl implements Keybinding {
  commandId: string
  combo: KeyComboImpl

  constructor(obj: Keybinding) {
    this.commandId = obj.commandId
    this.combo = new KeyComboImpl(obj.combo)
  }

  equals(other: any): boolean {
    if (toRaw(other) instanceof KeybindingImpl) {
      return (
        this.commandId === other.commandId && this.combo.equals(other.combo)
      )
    }
    return false
  }
}

export class KeyComboImpl implements KeyCombo {
  key: string
  // ctrl or meta(cmd on mac)
  ctrl: boolean
  alt: boolean
  shift: boolean

  constructor(obj: KeyCombo) {
    this.key = obj.key
    this.ctrl = obj.ctrl ?? false
    this.alt = obj.alt ?? false
    this.shift = obj.shift ?? false
  }

  equals(other: any): boolean {
    if (toRaw(other) instanceof KeyComboImpl) {
      return (
        this.key === other.key &&
        this.ctrl === other.ctrl &&
        this.alt === other.alt &&
        this.shift === other.shift
      )
    }
    return false
  }

  serialize(): string {
    return `${this.key}:${this.ctrl}:${this.alt}:${this.shift}`
  }

  deserialize(serialized: string): KeyComboImpl {
    const [key, ctrl, alt, shift] = serialized.split(':')
    return new KeyComboImpl({
      key,
      ctrl: ctrl === 'true',
      alt: alt === 'true',
      shift: shift === 'true'
    })
  }

  toString(): string {
    return `${this.key} + ${this.ctrl ? 'Ctrl' : ''}${this.alt ? 'Alt' : ''}${this.shift ? 'Shift' : ''}`
  }
}

export const useKeybindingStore = defineStore('keybinding', () => {
  /**
   * Default keybindings provided by core and extensions.
   */
  const defaultKeybindings = ref<Record<string, KeybindingImpl>>({})
  /**
   * User-defined keybindings.
   */
  const userKeybindings = ref<Record<string, KeybindingImpl>>({})
  /**
   * User-defined keybindings that unset default keybindings.
   */
  const userUnsetKeybindings = ref<Record<string, KeybindingImpl>>({})

  const keybindingByKeyCombo = computed<Record<string, KeybindingImpl>>(() => {
    const result: Record<string, KeybindingImpl> = {
      ...defaultKeybindings.value,
      ...userKeybindings.value
    }

    for (const keybinding of Object.values(userUnsetKeybindings.value)) {
      const serializedCombo = keybinding.combo.serialize()
      if (result[serializedCombo]?.equals(keybinding)) {
        delete result[serializedCombo]
      }
    }
    return result
  })

  const keybindings = computed<KeybindingImpl[]>(() =>
    Object.values(keybindingByKeyCombo.value)
  )

  function getKeybinding(combo: KeyComboImpl) {
    return keybindingByKeyCombo.value[combo.serialize()]
  }

  function addKeybinding(
    target: Ref<Record<string, KeybindingImpl>>,
    keybinding: KeybindingImpl,
    { existOk = false }: { existOk: boolean }
  ) {
    if (!existOk && keybinding.combo.serialize() in target.value) {
      throw new Error(
        `Keybinding on ${keybinding.combo} already exists on ${
          target.value[keybinding.combo.serialize()].commandId
        }`
      )
    }
    target.value[keybinding.combo.serialize()] = keybinding
  }

  function addDefaultKeybinding(keybinding: KeybindingImpl) {
    addKeybinding(defaultKeybindings, keybinding, { existOk: false })
  }

  function addUserKeybinding(keybinding: KeybindingImpl) {
    const defaultKeybinding =
      defaultKeybindings.value[keybinding.combo.serialize()]
    if (defaultKeybinding) {
      unsetKeybinding(defaultKeybinding)
    }
    addKeybinding(userKeybindings, keybinding, { existOk: true })
  }

  function unsetKeybinding(keybinding: KeybindingImpl) {
    const serializedCombo = keybinding.combo.serialize()
    if (!(serializedCombo in keybindingByKeyCombo.value)) {
      throw new Error(`Keybinding on ${keybinding.combo} does not exist`)
    }

    if (userKeybindings.value[serializedCombo]?.equals(keybinding)) {
      delete userKeybindings.value[serializedCombo]
      return
    }

    if (defaultKeybindings.value[serializedCombo]?.equals(keybinding)) {
      addKeybinding(userUnsetKeybindings, keybinding, { existOk: false })
      return
    }

    throw new Error(`NOT_REACHED`)
  }

  function loadUserKeybindings() {
    const settingStore = useSettingStore()
    // Unset bindings first as new bindings might conflict with default bindings.
    const unsetBindings = settingStore.get('Comfy.Keybinding.UnsetBindings')
    for (const keybinding of unsetBindings) {
      unsetKeybinding(new KeybindingImpl(keybinding))
    }
    const newBindings = settingStore.get('Comfy.Keybinding.NewBindings')
    for (const keybinding of newBindings) {
      addUserKeybinding(new KeybindingImpl(keybinding))
    }
  }

  function loadCoreKeybindings() {
    for (const keybinding of CORE_KEYBINDINGS) {
      addDefaultKeybinding(new KeybindingImpl(keybinding))
    }
  }

  function loadExtensionKeybindings(extension: ComfyExtension) {
    if (extension.keybindings) {
      for (const keybinding of extension.keybindings) {
        addDefaultKeybinding(new KeybindingImpl(keybinding))
      }
    }
  }

  return {
    keybindings,
    getKeybinding,
    addDefaultKeybinding,
    addUserKeybinding,
    unsetKeybinding,
    loadUserKeybindings,
    loadCoreKeybindings,
    loadExtensionKeybindings
  }
})
