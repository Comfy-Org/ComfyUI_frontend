// @ts-strict-ignore - will remove in the future

import { defineStore } from 'pinia'
import { computed, Ref, ref, toRaw } from 'vue'
import {
  Keybinding,
  KeyCombo,
  KeyBindingContext
} from '@/types/keyBindingTypes'
import { useSettingStore } from './settingStore'
import { CORE_KEYBINDINGS } from '@/constants/coreKeybindings'
import type { ComfyExtension } from '@/types/comfy'

export class KeybindingImpl implements Keybinding {
  readonly commandId: string
  readonly combo?: KeyComboImpl | null
  currentCombo?: KeyComboImpl | null = null
  readonly targetSelector?: string
  readonly context?: string

  constructor(obj: Keybinding) {
    this.commandId = obj.commandId
    this.combo = obj.combo ? new KeyComboImpl(obj.combo) : null
    this.currentCombo = this.combo
    if (obj.currentCombo) this.currentCombo = new KeyComboImpl(obj.currentCombo)
    this.targetSelector = obj.targetSelector
    this.context = obj.context ?? 'global'
  }

  get defaultCombo(): KeyComboImpl {
    return this.combo
  }

  get effectiveCombo(): KeyComboImpl {
    return this.currentCombo // null = unset, currentCombo != combo = user set combo
  }

  overwriteCombo(combo: KeyComboImpl) {
    this.currentCombo = combo // user set combo
  }

  unsetCombo() {
    this.currentCombo = null // unset
  }

  resetCombo() {
    this.currentCombo = this.combo
  }

  isModified(): boolean {
    return this.currentCombo !== this.combo
  }

  equals(other: unknown): boolean {
    const raw = toRaw(other)
    if (!(raw instanceof KeybindingImpl)) return false

    return (
      this.commandId === raw.commandId &&
      this.combo.equals(raw.combo) &&
      this.targetSelector === raw.targetSelector &&
      this.context === raw.context
    )
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

  static fromEvent(event: KeyboardEvent) {
    return new KeyComboImpl({
      key: event.key,
      ctrl: event.ctrlKey || event.metaKey,
      alt: event.altKey,
      shift: event.shiftKey
    })
  }

  equals(other: unknown): boolean {
    const raw = toRaw(other)

    return raw instanceof KeyComboImpl
      ? this.key.toUpperCase() === raw.key.toUpperCase() &&
          this.ctrl === raw.ctrl &&
          this.alt === raw.alt &&
          this.shift === raw.shift
      : false
  }

  serialize(): string {
    return `${this.key.toUpperCase()}:${this.ctrl}:${this.alt}:${this.shift}`
  }

  toString(): string {
    return this.getKeySequences().join(' + ')
  }

  get hasModifier(): boolean {
    return this.ctrl || this.alt || this.shift
  }

  get isModifier(): boolean {
    return ['Control', 'Meta', 'Alt', 'Shift'].includes(this.key)
  }

  getKeySequences(): string[] {
    const sequences: string[] = []
    if (this.ctrl) {
      sequences.push('Ctrl')
    }
    if (this.alt) {
      sequences.push('Alt')
    }
    if (this.shift) {
      sequences.push('Shift')
    }
    sequences.push(this.key)
    return sequences
  }
}

export class KeyBindingContextImpl implements KeyBindingContext {
  id: string
  name: string

  constructor(obj: KeyBindingContext) {
    this.id = obj.id
    this.name = obj.name
  }
}

export const useKeybindingStore = defineStore('keybinding2', () => {
  const keybindings = ref<KeybindingImpl[]>([])
  const keybindingContexts = ref<KeyBindingContextImpl[]>([
    {
      id: 'global',
      name: 'Global'
    }
  ]) // global is default
  function getKeybinding(
    combo: KeyCombo,
    context: string = 'global'
  ): KeybindingImpl | undefined {
    return keybindings.value.find((keybinding) => {
      return (
        keybinding.effectiveCombo &&
        keybinding.effectiveCombo.equals(combo) &&
        keybinding.context === context
      )
    })
  }

  function getKeybindingsByCommandId(commandId: string): KeybindingImpl[] {
    return keybindings.value.filter(
      (keybinding) => keybinding.commandId === commandId
    )
  }

  function getKeybindingByCommandId(
    commandId: string
  ): KeybindingImpl | undefined {
    return getKeybindingsByCommandId(commandId)[0]
  }

  function addKeybinding(keybinding: KeybindingImpl) {
    if (
      getKeybinding(keybinding.effectiveCombo, keybinding.context) !== undefined
    ) {
      throw new Error(`Keybinding ${keybinding.commandId} already exists.`)
    }
    keybindings.value.push(keybinding)
  }

  function addDefaultKeybinding(keybinding: KeybindingImpl) {
    addKeybinding(keybinding)
  }

  function addUserKeybinding(keybinding: KeybindingImpl) {
    const effectiveCombo = keybinding.effectiveCombo
    const context = keybinding.context ?? 'global'

    const existingKeybinding = getKeybinding(effectiveCombo, context)
    if (existingKeybinding) {
      existingKeybinding.overwriteCombo(effectiveCombo)
    } else {
      addKeybinding(keybinding)
    }
  }

  function unsetKeybinding(commandId: string) {
    const existingKeybinding = getKeybindingByCommandId(commandId)

    if (existingKeybinding) {
      existingKeybinding.unsetCombo()
    }
  }

  function updateKeybindingOnCommand(keybinding: KeybindingImpl): boolean {
    const existingKeybinding1 = getKeybindingByCommandId(keybinding.commandId)
    const existingKeybinding2 = getKeybinding(
      keybinding.effectiveCombo,
      keybinding.context
    )

    if (existingKeybinding1) {
      existingKeybinding1.overwriteCombo(keybinding.effectiveCombo)
      return true
    }
    if (existingKeybinding2) {
      existingKeybinding2.overwriteCombo(keybinding.effectiveCombo)
      return true
    }

    addKeybinding(keybinding)
    return true
  }

  async function loadUserKeybindings() {
    const settingStore = useSettingStore()

    // Load modified bindings from settings
    const modifiedBindings =
      settingStore.get('Comfy.Keybinding.ModifiedBindings') ?? []
    for (const binding of modifiedBindings) {
      const existing = getKeybindingByCommandId(binding.commandId)
      if (existing != null && binding) {
        const keyCombo = binding.currentCombo
          ? new KeyComboImpl(binding.currentCombo)
          : null
        existing.overwriteCombo(keyCombo)
      }
    }
  }

  function loadCoreKeybindings() {
    // Simply load core keybindings as defaults
    for (const keybinding of CORE_KEYBINDINGS) {
      addDefaultKeybinding(new KeybindingImpl(keybinding))
    }
  }

  function loadExtensionKeybindingContexts(extension: ComfyExtension) {
    if (extension.keybindingContexts) {
      for (const context of extension.keybindingContexts) {
        if (!keybindingContexts.value.includes(context)) {
          keybindingContexts.value.push(context)
        }
      }
    }
  }

  function loadExtensionKeybindings(extension: ComfyExtension) {
    if (extension.keybindings) {
      for (const keybinding of extension.keybindings) {
        try {
          addUserKeybinding(new KeybindingImpl(keybinding))
        } catch (error) {
          console.warn(
            `Failed to load keybinding for extension ${extension.name}`,
            error
          )
        }
      }
    }
  }

  async function persistUserKeybindings() {
    const settingStore = useSettingStore()

    // Only save modified keybindings
    const modifiedBindings = keybindings.value
      .filter((kb) => kb.isModified())
      .map((kb) => ({
        commandId: kb.commandId,
        currentCombo: kb.currentCombo
      }))

    await settingStore.set(
      'Comfy.Keybinding.ModifiedBindings',
      modifiedBindings
    )
  }

  function resetKeybindings() {
    for (const keybinding of keybindings.value) {
      keybinding.resetCombo()
    }
  }

  function isCommandKeybindingModified(commandId: string): boolean {
    const keybinding = getKeybindingByCommandId(commandId)
    if (!keybinding)
      throw new Error(`Keybinding for command ${commandId} not found.`)
    return keybinding.isModified()
  }

  return {
    keybindings,
    keybindingContexts,
    getKeybinding,
    getKeybindingsByCommandId,
    getKeybindingByCommandId,
    addDefaultKeybinding,
    addUserKeybinding,
    unsetKeybinding,
    updateKeybindingOnCommand,
    loadUserKeybindings,
    loadCoreKeybindings,
    loadExtensionKeybindings,
    loadExtensionKeybindingContexts,
    persistUserKeybindings,
    resetKeybindings,
    isCommandKeybindingModified
  }
})
