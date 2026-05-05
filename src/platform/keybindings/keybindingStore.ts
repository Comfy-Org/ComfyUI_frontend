import { groupBy } from 'es-toolkit/compat'
import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import { computed, ref, shallowRef } from 'vue'

import type { KeyComboImpl } from './keyCombo'
import { KeybindingImpl } from './keybinding'
import type { KeybindingPreset } from './types'

export const useKeybindingStore = defineStore('keybinding', () => {
  const defaultKeybindings = shallowRef<Record<string, KeybindingImpl>>({})
  const userKeybindings = shallowRef<Record<string, KeybindingImpl>>({})
  const userUnsetKeybindings = shallowRef<Record<string, KeybindingImpl>>({})

  const currentPresetName = ref('default')
  const savedPresetData = ref<KeybindingPreset | null>(null)

  const serializeBinding = (b: KeybindingImpl) =>
    `${b.commandId}:${b.combo.serialize()}:${b.targetElementId ?? ''}`

  const savedPresetSerialized = computed(() => {
    if (!savedPresetData.value) return null
    const savedNew = savedPresetData.value.newBindings
      .map((b) => serializeBinding(new KeybindingImpl(b)))
      .sort()
      .join('|')
    const savedUnset = savedPresetData.value.unsetBindings
      .map((b) => serializeBinding(new KeybindingImpl(b)))
      .sort()
      .join('|')
    return { savedNew, savedUnset }
  })

  const isCurrentPresetModified = computed(() => {
    const newBindings = Object.values(userKeybindings.value)
    const unsetBindings = Object.values(userUnsetKeybindings.value)

    if (currentPresetName.value === 'default') {
      return newBindings.length > 0 || unsetBindings.length > 0
    }

    if (!savedPresetSerialized.value) return false

    const currentNew = newBindings.map(serializeBinding).sort().join('|')
    const currentUnset = unsetBindings.map(serializeBinding).sort().join('|')

    return (
      currentNew !== savedPresetSerialized.value.savedNew ||
      currentUnset !== savedPresetSerialized.value.savedUnset
    )
  })

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
    target.value = {
      ...target.value,
      [keybinding.combo.serialize()]: keybinding
    }
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
      const updated = { ...userUnsetKeybindings.value }
      delete updated[keybinding.combo.serialize()]
      userUnsetKeybindings.value = updated
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
      const updated = { ...userKeybindings.value }
      delete updated[serializedCombo]
      userKeybindings.value = updated
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

    const updatedUnset = { ...userUnsetKeybindings.value }
    for (const defaultBinding of defaultBindings) {
      const serializedCombo = defaultBinding.combo.serialize()
      if (updatedUnset[serializedCombo]?.equals(defaultBinding)) {
        delete updatedUnset[serializedCombo]
      }
    }
    userUnsetKeybindings.value = updatedUnset

    return true
  }

  const modifiedCommandIds = computed<Set<string>>(() => {
    const result = new Set<string>()
    const allCommandIds = new Set([
      ...Object.keys(keybindingsByCommandId.value),
      ...Object.keys(defaultKeybindingsByCommandId.value)
    ])

    for (const commandId of allCommandIds) {
      const currentBindings = keybindingsByCommandId.value[commandId] ?? []
      const defaultBindings =
        defaultKeybindingsByCommandId.value[commandId] ?? []

      if (currentBindings.length !== defaultBindings.length) {
        result.add(commandId)
        continue
      }
      if (currentBindings.length === 0) continue

      const sortedCurrent = [...currentBindings]
        .map((b) => b.combo.serialize())
        .sort()
      const sortedDefault = [...defaultBindings]
        .map((b) => b.combo.serialize())
        .sort()

      if (sortedCurrent.some((combo, i) => combo !== sortedDefault[i])) {
        result.add(commandId)
      }
    }

    return result
  })

  function isCommandKeybindingModified(commandId: string): boolean {
    return modifiedCommandIds.value.has(commandId)
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
    currentPresetName,
    savedPresetData,
    isCurrentPresetModified,
    removeAllKeybindingsForCommand,
    updateSpecificKeybinding
  }
})
