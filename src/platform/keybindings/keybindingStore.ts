import { groupBy } from 'es-toolkit/compat'
import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import { computed, ref } from 'vue'

import type { KeyComboImpl } from './keyCombo'
import { KeybindingImpl } from './keybinding'
import type { KeybindingPreset } from './types'

export const useKeybindingStore = defineStore('keybinding', () => {
  const defaultKeybindings = ref<Record<string, KeybindingImpl>>({})
  const userKeybindings = ref<Record<string, KeybindingImpl>>({})
  const userUnsetKeybindings = ref<Record<string, KeybindingImpl>>({})

  const currentPresetName = ref('default')
  const savedPresetData = ref<KeybindingPreset | null>(null)

  const isCurrentPresetModified = computed(() => {
    const newBindings = Object.values(userKeybindings.value)
    const unsetBindings = Object.values(userUnsetKeybindings.value)

    if (currentPresetName.value === 'default') {
      return newBindings.length > 0 || unsetBindings.length > 0
    }

    if (!savedPresetData.value) return false

    const serialize = (b: KeybindingImpl) =>
      `${b.commandId}:${b.combo.serialize()}:${b.targetElementId ?? ''}`

    const currentNew = newBindings.map(serialize).sort().join('|')
    const savedNew = savedPresetData.value.newBindings
      .map((b) => serialize(new KeybindingImpl(b)))
      .sort()
      .join('|')

    const currentUnset = unsetBindings.map(serialize).sort().join('|')
    const savedUnset = savedPresetData.value.unsetBindings
      .map((b) => serialize(new KeybindingImpl(b)))
      .sort()
      .join('|')

    return currentNew !== savedNew || currentUnset !== savedUnset
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

  function resetKeybindingForCommand(commandId: string): boolean {
    const currentKeybinding = getKeybindingByCommandId(commandId)
    const defaultKeybinding =
      defaultKeybindingsByCommandId.value[commandId]?.[0]

    if (!defaultKeybinding) {
      if (currentKeybinding) {
        unsetKeybinding(currentKeybinding)
        return true
      }
      return false
    }

    if (currentKeybinding?.equals(defaultKeybinding)) {
      return false
    }

    if (currentKeybinding) {
      unsetKeybinding(currentKeybinding)
    }

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
    isCommandKeybindingModified,
    currentPresetName,
    savedPresetData,
    isCurrentPresetModified
  }
})
