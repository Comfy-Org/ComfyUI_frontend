import { KeyComboImpl, KeybindingImpl } from '@comfyorg/keybinding'
import _ from 'es-toolkit/compat'
import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import { computed, ref } from 'vue'

// Re-export classes from package for backward compatibility
export { KeybindingImpl, KeyComboImpl }

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
