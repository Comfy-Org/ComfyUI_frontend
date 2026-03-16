import { groupBy } from 'es-toolkit/compat'
import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import { computed, ref } from 'vue'

import type { KeyComboImpl } from './keyCombo'
import type { KeybindingImpl } from './keybinding'

export const useKeybindingStore = defineStore('keybinding', () => {
  const defaultKeybindings = ref<Record<string, KeybindingImpl>>({})
  const userKeybindings = ref<Record<string, KeybindingImpl>>({})
  const userUnsetKeybindings = ref<Record<string, KeybindingImpl>>({})

  function getUserKeybindings() {
    return userKeybindings.value
  }

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
      return groupBy(keybindings.value, 'commandId')
    }
  )

  function getKeybindingsByCommandId(commandId: string) {
    return keybindingsByCommandId.value[commandId] ?? []
  }

  const defaultKeybindingsByCommandId = computed<
    Record<string, KeybindingImpl[]>
  >(() => {
    return groupBy(Object.values(defaultKeybindings.value), 'commandId')
  })

  function getKeybindingByCommandId(commandId: string) {
    return getKeybindingsByCommandId(commandId)[0]
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
    const userUnsetKeybinding =
      userUnsetKeybindings.value[keybinding.combo.serialize()]

    if (
      keybinding.equals(defaultKeybinding) &&
      keybinding.equals(userUnsetKeybinding)
    ) {
      delete userUnsetKeybindings.value[keybinding.combo.serialize()]
      return
    }

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

  function removeAllKeybindingsForCommand(commandId: string): boolean {
    const currentBindings = getKeybindingsByCommandId(commandId)
    if (currentBindings.length === 0) return false
    for (const binding of currentBindings) {
      unsetKeybinding(binding)
    }
    return true
  }

  function updateSpecificKeybinding(
    oldBinding: KeybindingImpl,
    newBinding: KeybindingImpl
  ) {
    unsetKeybinding(oldBinding)
    addUserKeybinding(newBinding)
  }

  function resetKeybindingForCommand(commandId: string): boolean {
    const currentBindings = getKeybindingsByCommandId(commandId)
    const defaultBindings = defaultKeybindingsByCommandId.value[commandId] ?? []

    if (defaultBindings.length === 0) {
      if (currentBindings.length > 0) {
        for (const binding of currentBindings) {
          unsetKeybinding(binding)
        }
        return true
      }
      return false
    }

    if (!isCommandKeybindingModified(commandId)) {
      return false
    }

    for (const binding of currentBindings) {
      unsetKeybinding(binding)
    }

    for (const defaultBinding of defaultBindings) {
      const serializedCombo = defaultBinding.combo.serialize()
      if (userUnsetKeybindings.value[serializedCombo]?.equals(defaultBinding)) {
        delete userUnsetKeybindings.value[serializedCombo]
      }
    }

    return true
  }

  function isCommandKeybindingModified(commandId: string): boolean {
    const currentBindings = getKeybindingsByCommandId(commandId)
    const defaultBindings = defaultKeybindingsByCommandId.value[commandId] ?? []

    if (currentBindings.length !== defaultBindings.length) return true
    if (currentBindings.length === 0) return false

    const sortedCurrent = [...currentBindings]
      .map((b) => b.combo.serialize())
      .sort()
    const sortedDefault = [...defaultBindings]
      .map((b) => b.combo.serialize())
      .sort()

    return sortedCurrent.some((combo, i) => combo !== sortedDefault[i])
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
    isCommandKeybindingModified,
    removeAllKeybindingsForCommand,
    updateSpecificKeybinding
  }
})
