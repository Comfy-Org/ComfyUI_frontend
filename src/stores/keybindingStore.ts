import _ from 'lodash'
import { defineStore } from 'pinia'
import { Ref, computed, ref, toRaw } from 'vue'

import { RESERVED_BY_TEXT_INPUT } from '@/constants/reservedKeyCombos'
import { KeyCombo, Keybinding } from '@/schemas/keyBindingSchema'

export class KeybindingImpl implements Keybinding {
  commandId: string
  combo: KeyComboImpl
  targetElementId?: string

  constructor(obj: Keybinding) {
    this.commandId = obj.commandId
    this.combo = new KeyComboImpl(obj.combo)
    this.targetElementId = obj.targetElementId
  }

  equals(other: unknown): boolean {
    const raw = toRaw(other)

    return raw instanceof KeybindingImpl
      ? this.commandId === raw.commandId &&
          this.combo.equals(raw.combo) &&
          this.targetElementId === raw.targetElementId
      : false
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

  get modifierCount(): number {
    const modifiers = [this.ctrl, this.alt, this.shift]
    return modifiers.reduce((acc, cur) => acc + Number(cur), 0)
  }

  get isShiftOnly(): boolean {
    return this.shift && this.modifierCount === 1
  }

  get isReservedByTextInput(): boolean {
    return (
      !this.hasModifier ||
      this.isShiftOnly ||
      RESERVED_BY_TEXT_INPUT.has(this.toString())
    )
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

  /**
   * Get user-defined keybindings.
   */
  function getUserKeybindings() {
    return userKeybindings.value
  }

  /**
   * Get user-defined keybindings that unset default keybindings.
   */
  function getUserUnsetKeybindings() {
    return userUnsetKeybindings.value
  }

  const keybindingByKeyCombo = computed<Record<string, KeybindingImpl>>(() => {
    const result: Record<string, KeybindingImpl> = {
      ...defaultKeybindings.value
    }

    for (const keybinding of Object.values(userUnsetKeybindings.value)) {
      const serializedCombo = keybinding.combo.serialize()
      if (result[serializedCombo]?.equals(keybinding)) {
        delete result[serializedCombo]
      }
    }

    return {
      ...result,
      ...userKeybindings.value
    }
  })

  const keybindings = computed<KeybindingImpl[]>(() =>
    Object.values(keybindingByKeyCombo.value)
  )

  function getKeybinding(combo: KeyComboImpl) {
    return keybindingByKeyCombo.value[combo.serialize()]
  }

  const keybindingsByCommandId = computed<Record<string, KeybindingImpl[]>>(
    () => {
      return _.groupBy(keybindings.value, 'commandId')
    }
  )

  function getKeybindingsByCommandId(commandId: string) {
    return keybindingsByCommandId.value[commandId] ?? []
  }

  const defaultKeybindingsByCommandId = computed<
    Record<string, KeybindingImpl[]>
  >(() => {
    return _.groupBy(Object.values(defaultKeybindings.value), 'commandId')
  })

  function getKeybindingByCommandId(commandId: string) {
    return getKeybindingsByCommandId(commandId)[0]
  }

  /**
   * Adds a keybinding to the specified target reference.
   *
   * @param target - A ref that holds a record of keybindings. The keys represent
   * serialized key combos, and the values are `KeybindingImpl` objects.
   * @param keybinding - The keybinding to add, represented as a `KeybindingImpl` object.
   * @param options - An options object.
   * @param options.existOk - If true, allows overwriting an existing keybinding with the
   * same combo. Defaults to false.
   *
   * @throws {Error} Throws an error if a keybinding with the same combo already exists in
   * the target and `existOk` is false.
   */
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
    const userUnsetKeybinding =
      userUnsetKeybindings.value[keybinding.combo.serialize()]

    // User is adding back a keybinding that was an unsetted default keybinding.
    if (
      keybinding.equals(defaultKeybinding) &&
      keybinding.equals(userUnsetKeybinding)
    ) {
      delete userUnsetKeybindings.value[keybinding.combo.serialize()]
      return
    }

    // Unset keybinding on default keybinding if it exists and is not the same as userUnsetKeybinding
    if (defaultKeybinding && !defaultKeybinding.equals(userUnsetKeybinding)) {
      unsetKeybinding(defaultKeybinding)
    }

    addKeybinding(userKeybindings, keybinding, { existOk: true })
  }

  function unsetKeybinding(keybinding: KeybindingImpl) {
    const serializedCombo = keybinding.combo.serialize()
    if (!(serializedCombo in keybindingByKeyCombo.value)) {
      console.warn(
        `Trying to unset non-exist keybinding: ${JSON.stringify(keybinding)}`
      )
      return
    }

    if (userKeybindings.value[serializedCombo]?.equals(keybinding)) {
      delete userKeybindings.value[serializedCombo]
      return
    }

    if (defaultKeybindings.value[serializedCombo]?.equals(keybinding)) {
      addKeybinding(userUnsetKeybindings, keybinding, { existOk: false })
      return
    }

    console.warn(`Unset unknown keybinding: ${JSON.stringify(keybinding)}`)
  }

  /**
   * Update the keybinding on given command if it is different from the current keybinding.
   *
   * @returns true if the keybinding is updated, false otherwise.
   */
  function updateKeybindingOnCommand(keybinding: KeybindingImpl): boolean {
    const currentKeybinding = getKeybindingByCommandId(keybinding.commandId)
    if (currentKeybinding?.equals(keybinding)) {
      return false
    }
    if (currentKeybinding) {
      unsetKeybinding(currentKeybinding)
    }
    addUserKeybinding(keybinding)
    return true
  }

  function resetAllKeybindings() {
    userKeybindings.value = {}
    userUnsetKeybindings.value = {}
  }

  /**
   * Resets the keybinding for a given command to its default value.
   *
   * @param commandId - The commandId of the keybind to be reset
   * @returns `true` if changes were made, `false` if not
   */
  function resetKeybindingForCommand(commandId: string): boolean {
    const currentKeybinding = getKeybindingByCommandId(commandId)
    const defaultKeybinding =
      defaultKeybindingsByCommandId.value[commandId]?.[0]

    // No default keybinding exists, need to remove any user binding
    if (!defaultKeybinding) {
      if (currentKeybinding) {
        unsetKeybinding(currentKeybinding)
        return true
      }
      return false
    }

    // Current binding equals default binding, no changes needed
    if (currentKeybinding?.equals(defaultKeybinding)) {
      return false
    }

    // Unset current keybinding if exists
    if (currentKeybinding) {
      unsetKeybinding(currentKeybinding)
    }

    // Remove the unset record if it exists
    const serializedCombo = defaultKeybinding.combo.serialize()
    if (
      userUnsetKeybindings.value[serializedCombo]?.equals(defaultKeybinding)
    ) {
      delete userUnsetKeybindings.value[serializedCombo]
    }

    return true
  }

  function isCommandKeybindingModified(commandId: string): boolean {
    const currentKeybinding: KeybindingImpl | undefined =
      getKeybindingByCommandId(commandId)
    const defaultKeybinding: KeybindingImpl | undefined =
      defaultKeybindingsByCommandId.value[commandId]?.[0]

    return !(
      (currentKeybinding === undefined && defaultKeybinding === undefined) ||
      currentKeybinding?.equals(defaultKeybinding)
    )
  }

  return {
    keybindings,
    getUserKeybindings,
    getUserUnsetKeybindings,
    getKeybinding,
    getKeybindingsByCommandId,
    getKeybindingByCommandId,
    addDefaultKeybinding,
    addUserKeybinding,
    unsetKeybinding,
    updateKeybindingOnCommand,
    resetAllKeybindings,
    resetKeybindingForCommand,
    isCommandKeybindingModified
  }
})
