import { groupBy } from 'es-toolkit/compat'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import type { KeyComboImpl } from './keyCombo'
import { KeybindingImpl } from './keybinding'
import type { KeybindingPreset } from './types'
import { whenClauseSpecificity } from './whenClause'

function scopeKey(combo: KeyComboImpl, dialogKey: string | undefined) {
  return `${combo.serialize()}:${dialogKey ?? ''}`
}

/** Same combo, scope and clause: the dispatcher could not tell them apart. */
function conflicts(a: KeybindingImpl, b: KeybindingImpl): boolean {
  return (
    a.combo.equals(b.combo) && a.dialogKey === b.dialogKey && a.when === b.when
  )
}

/** Narrower clauses first; within a clause width, user bindings first. */
function byResolutionOrder(a: KeybindingImpl, b: KeybindingImpl): number {
  return whenClauseSpecificity(b.when) - whenClauseSpecificity(a.when)
}

function without(bindings: KeybindingImpl[], binding: KeybindingImpl) {
  return bindings.filter((existing) => !existing.equals(binding))
}

export const useKeybindingStore = defineStore('keybinding', () => {
  const defaultKeybindings = shallowRef<KeybindingImpl[]>([])
  const userKeybindings = shallowRef<KeybindingImpl[]>([])
  const userUnsetKeybindings = shallowRef<KeybindingImpl[]>([])

  const currentPresetName = ref('default')
  const savedPresetData = ref<KeybindingPreset | null>(null)

  const savedPresetSerialized = computed(() => {
    if (!savedPresetData.value) return null
    const savedNew = savedPresetData.value.newBindings
      .map((b) => new KeybindingImpl(b).serialize())
      .sort()
      .join('|')
    const savedUnset = savedPresetData.value.unsetBindings
      .map((b) => new KeybindingImpl(b).serialize())
      .sort()
      .join('|')
    return { savedNew, savedUnset }
  })

  const isCurrentPresetModified = computed(() => {
    const newBindings = userKeybindings.value
    const unsetBindings = userUnsetKeybindings.value

    if (currentPresetName.value === 'default') {
      return newBindings.length > 0 || unsetBindings.length > 0
    }

    if (!savedPresetSerialized.value) return false

    const currentNew = newBindings
      .map((b) => b.serialize())
      .sort()
      .join('|')
    const currentUnset = unsetBindings
      .map((b) => b.serialize())
      .sort()
      .join('|')

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

  const activeDefaultKeybindings = computed(() =>
    defaultKeybindings.value.filter(
      (binding) =>
        !userUnsetKeybindings.value.some((unset) => unset.equals(binding))
    )
  )

  const keybindings = computed<KeybindingImpl[]>(() => [
    ...activeDefaultKeybindings.value.filter(
      (binding) =>
        !userKeybindings.value.some((user) => conflicts(user, binding))
    ),
    ...userKeybindings.value
  ])

  const keybindingsByScope = computed<Record<string, KeybindingImpl[]>>(() => {
    const groups = groupBy(
      [...userKeybindings.value, ...activeDefaultKeybindings.value],
      (binding) => scopeKey(binding.combo, binding.dialogKey)
    )
    for (const group of Object.values(groups)) group.sort(byResolutionOrder)
    return groups
  })

  /** Active bindings for a combo in a scope, in the order the dispatcher tries them. */
  function getKeybindings(
    combo: KeyComboImpl,
    dialogKey?: string
  ): KeybindingImpl[] {
    return keybindingsByScope.value[scopeKey(combo, dialogKey)] ?? []
  }

  function findConflictingKeybinding(
    keybinding: KeybindingImpl
  ): KeybindingImpl | undefined {
    return getKeybindings(keybinding.combo, keybinding.dialogKey).find(
      (binding) => conflicts(binding, keybinding)
    )
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
    return groupBy(defaultKeybindings.value, 'commandId')
  })

  function getDefaultKeybindingsByCommandId(commandId: string) {
    return defaultKeybindingsByCommandId.value[commandId] ?? []
  }

  function getKeybindingByCommandId(commandId: string) {
    return getKeybindingsByCommandId(commandId)[0]
  }

  function addDefaultKeybinding(keybinding: KeybindingImpl) {
    const existing = defaultKeybindings.value.find((binding) =>
      conflicts(binding, keybinding)
    )
    if (existing) {
      throw new Error(
        `Keybinding on ${keybinding.combo} already exists on ${existing.commandId}`
      )
    }
    defaultKeybindings.value = [...defaultKeybindings.value, keybinding]
    userKeybindings.value = without(userKeybindings.value, keybinding)
  }

  function addUserKeybinding(keybinding: KeybindingImpl) {
    const isDefault = defaultKeybindings.value.some((binding) =>
      binding.equals(keybinding)
    )
    const unset = userUnsetKeybindings.value.find((binding) =>
      binding.equals(keybinding)
    )
    if (isDefault && unset) {
      userUnsetKeybindings.value = without(userUnsetKeybindings.value, unset)
      userKeybindings.value = userKeybindings.value.filter(
        (binding) => !conflicts(binding, keybinding)
      )
      return
    }
    if (isDefault) return

    for (const binding of activeDefaultKeybindings.value) {
      if (conflicts(binding, keybinding)) unsetKeybinding(binding)
    }
    userKeybindings.value = [
      ...userKeybindings.value.filter(
        (binding) => !conflicts(binding, keybinding)
      ),
      keybinding
    ]
  }

  function unsetKeybinding(keybinding: KeybindingImpl) {
    const user = userKeybindings.value.find((binding) =>
      binding.equals(keybinding)
    )
    if (user) {
      userKeybindings.value = without(userKeybindings.value, user)
      return
    }

    const active = activeDefaultKeybindings.value.find((binding) =>
      binding.equals(keybinding)
    )
    if (active) {
      userUnsetKeybindings.value = [...userUnsetKeybindings.value, active]
      return
    }

    console.warn(
      `Trying to unset non-exist keybinding: ${JSON.stringify(keybinding)}`
    )
  }

  function resetAllKeybindings() {
    userKeybindings.value = []
    userUnsetKeybindings.value = []
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
    const defaultBindings = getDefaultKeybindingsByCommandId(commandId)

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
    for (const binding of userKeybindings.value) {
      if (
        defaultBindings.some((defaultBinding) =>
          conflicts(defaultBinding, binding)
        )
      ) {
        unsetKeybinding(binding)
      }
    }

    userUnsetKeybindings.value = userUnsetKeybindings.value.filter(
      (unset) => !defaultBindings.some((binding) => binding.equals(unset))
    )

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

      const sortedCurrent = currentBindings.map((b) => b.serialize()).sort()
      const sortedDefault = defaultBindings.map((b) => b.serialize()).sort()

      if (sortedCurrent.some((binding, i) => binding !== sortedDefault[i])) {
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
    getKeybindings,
    findConflictingKeybinding,
    getKeybindingsByCommandId,
    getDefaultKeybindingsByCommandId,
    getKeybindingByCommandId,
    addDefaultKeybinding,
    addUserKeybinding,
    unsetKeybinding,
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
