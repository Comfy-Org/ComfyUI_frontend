import { groupBy } from 'es-toolkit/compat'
import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import { computed, ref, shallowRef } from 'vue'

import type { KeyComboImpl } from './keyCombo'
import { KeybindingImpl } from './keybinding'
import type { KeybindingPreset } from './types'

type KeybindingMap = Partial<Record<string, KeybindingImpl>>

interface UserChoices {
  user: KeybindingMap
  unset: KeybindingMap
  pendingUnset: KeybindingImpl[]
}

export interface KeybindingConflict {
  existing: KeybindingImpl
  incoming: KeybindingImpl
}

export type KeymapChange =
  | { ok: true; changed: boolean }
  | { ok: false; reason: 'conflict'; conflict: KeybindingConflict }

interface KeymapWriteOptions {
  replaceConflicts?: boolean
}

interface SavedChoices {
  newBindings: KeybindingImpl[]
  unsetBindings: KeybindingImpl[]
}

const EMPTY_USER_CHOICES: UserChoices = {
  user: {},
  unset: {},
  pendingUnset: []
}

function keybindingValues(keybindings: KeybindingMap): KeybindingImpl[] {
  return Object.values(keybindings).filter(
    (keybinding): keybinding is KeybindingImpl => keybinding !== undefined
  )
}

function withoutCombo(keybindings: KeybindingMap, serializedCombo: string) {
  const { [serializedCombo]: _removed, ...remaining } = keybindings
  return remaining
}

function refuseConflict(
  existing: KeybindingImpl,
  incoming: KeybindingImpl
): KeymapChange {
  return { ok: false, reason: 'conflict', conflict: { existing, incoming } }
}

export function findSavedChoiceConflicts(
  bindings: KeybindingImpl[]
): KeybindingConflict[] {
  const claimed = new Map<string, KeybindingImpl>()
  const conflicts: KeybindingConflict[] = []
  for (const incoming of bindings) {
    const serializedCombo = incoming.combo.serialize()
    const existing = claimed.get(serializedCombo)
    if (existing && !existing.equals(incoming)) {
      conflicts.push({ existing, incoming })
    }
    claimed.set(serializedCombo, incoming)
  }
  return conflicts
}

export const useKeybindingStore = defineStore('keybinding', () => {
  const defaultKeybindings = shallowRef<KeybindingMap>({})
  const userKeybindings = shallowRef<KeybindingMap>({})
  const userUnsetKeybindings = shallowRef<KeybindingMap>({})
  const pendingUnsetKeybindings = shallowRef<KeybindingImpl[]>([])

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
    const newBindings = keybindingValues(userKeybindings.value)

    if (currentPresetName.value === 'default') {
      return (
        newBindings.length > 0 ||
        keybindingValues(userUnsetKeybindings.value).length > 0
      )
    }

    if (!savedPresetSerialized.value) return false

    const currentNew = newBindings.map(serializeBinding).sort().join('|')
    const currentUnset = getUserUnsetKeybindingValues()
      .map(serializeBinding)
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

  function getUserKeybindingValues() {
    return keybindingValues(userKeybindings.value)
  }

  function getUserUnsetKeybindings() {
    return userUnsetKeybindings.value
  }

  function getUserUnsetKeybindingValues() {
    return [
      ...keybindingValues(userUnsetKeybindings.value),
      ...pendingUnsetKeybindings.value
    ]
  }

  function effectiveKeymap(choices: UserChoices): KeybindingMap {
    const result: KeybindingMap = {
      ...defaultKeybindings.value
    }

    for (const keybinding of keybindingValues(choices.unset)) {
      const serializedCombo = keybinding.combo.serialize()
      if (result[serializedCombo]?.equals(keybinding)) {
        delete result[serializedCombo]
      }
    }

    return {
      ...result,
      ...choices.user
    }
  }

  function currentChoices(): UserChoices {
    return {
      user: userKeybindings.value,
      unset: userUnsetKeybindings.value,
      pendingUnset: pendingUnsetKeybindings.value
    }
  }

  function commitChoices(choices: UserChoices) {
    userKeybindings.value = choices.user
    userUnsetKeybindings.value = choices.unset
    pendingUnsetKeybindings.value = choices.pendingUnset
  }

  function withUnsetChoice(
    choices: UserChoices,
    keybinding: KeybindingImpl
  ): UserChoices {
    const serializedCombo = keybinding.combo.serialize()
    const registeredDefault = defaultKeybindings.value[serializedCombo]
    if (registeredDefault) {
      return registeredDefault.equals(keybinding)
        ? {
            ...choices,
            unset: { ...choices.unset, [serializedCombo]: keybinding }
          }
        : choices
    }
    return choices.pendingUnset.some((unset) => unset.equals(keybinding))
      ? choices
      : { ...choices, pendingUnset: [...choices.pendingUnset, keybinding] }
  }

  function withUserBinding(
    choices: UserChoices,
    keybinding: KeybindingImpl
  ): UserChoices {
    const serializedCombo = keybinding.combo.serialize()
    const defaultKeybinding = defaultKeybindings.value[serializedCombo]
    const userUnsetKeybinding = choices.unset[serializedCombo]

    if (
      keybinding.equals(defaultKeybinding) &&
      keybinding.equals(userUnsetKeybinding)
    ) {
      return {
        ...choices,
        user: withoutCombo(choices.user, serializedCombo),
        unset: withoutCombo(choices.unset, serializedCombo)
      }
    }

    return {
      ...choices,
      unset:
        defaultKeybinding && !defaultKeybinding.equals(userUnsetKeybinding)
          ? { ...choices.unset, [serializedCombo]: defaultKeybinding }
          : choices.unset,
      user: { ...choices.user, [serializedCombo]: keybinding }
    }
  }

  function withoutBinding(
    choices: UserChoices,
    keybinding: KeybindingImpl
  ): UserChoices {
    const serializedCombo = keybinding.combo.serialize()
    if (!(serializedCombo in effectiveKeymap(choices))) {
      console.warn(
        `Trying to unset non-exist keybinding: ${JSON.stringify(keybinding)}`
      )
      return choices
    }

    if (choices.user[serializedCombo]?.equals(keybinding)) {
      return { ...choices, user: withoutCombo(choices.user, serializedCombo) }
    }

    if (defaultKeybindings.value[serializedCombo]?.equals(keybinding)) {
      return {
        ...choices,
        unset: { ...choices.unset, [serializedCombo]: keybinding }
      }
    }

    console.warn(`Unset unknown keybinding: ${JSON.stringify(keybinding)}`)
    return choices
  }

  function withoutBindings(
    choices: UserChoices,
    keybindings: KeybindingImpl[]
  ): UserChoices {
    return keybindings.reduce(withoutBinding, choices)
  }

  function writeUserBinding(
    base: UserChoices,
    keybinding: KeybindingImpl,
    { replaceConflicts = false }: KeymapWriteOptions
  ): KeymapChange {
    const existing = effectiveKeymap(base)[keybinding.combo.serialize()]
    if (existing && !existing.equals(keybinding) && !replaceConflicts) {
      return refuseConflict(existing, keybinding)
    }
    commitChoices(withUserBinding(base, keybinding))
    return { ok: true, changed: true }
  }

  const keybindingByKeyCombo = computed<KeybindingMap>(() =>
    effectiveKeymap(currentChoices())
  )

  const keybindings = computed<KeybindingImpl[]>(() =>
    keybindingValues(keybindingByKeyCombo.value)
  )

  function getKeybinding(combo: KeyComboImpl): KeybindingImpl | undefined {
    return keybindingByKeyCombo.value[combo.serialize()]
  }

  const keybindingsByCommandId = computed<
    Partial<Record<string, KeybindingImpl[]>>
  >(() => {
    return groupBy(keybindings.value, 'commandId')
  })

  function getKeybindingsByCommandId(commandId: string) {
    return keybindingsByCommandId.value[commandId] ?? []
  }

  const defaultKeybindingsByCommandId = computed<
    Partial<Record<string, KeybindingImpl[]>>
  >(() => groupBy(keybindingValues(defaultKeybindings.value), 'commandId'))

  function getKeybindingByCommandId(commandId: string) {
    return getKeybindingsByCommandId(commandId).at(0)
  }

  function addKeybinding(
    target: Ref<KeybindingMap>,
    keybinding: KeybindingImpl,
    { existOk }: { existOk: boolean }
  ) {
    const existing = target.value[keybinding.combo.serialize()]
    if (!existOk && existing) {
      throw new Error(
        `Keybinding on ${keybinding.combo} already exists on ${existing.commandId}`
      )
    }
    target.value = {
      ...target.value,
      [keybinding.combo.serialize()]: keybinding
    }
  }

  function addDefaultKeybinding(keybinding: KeybindingImpl) {
    addKeybinding(defaultKeybindings, keybinding, { existOk: false })
    const pending = pendingUnsetKeybindings.value.find((unset) =>
      unset.equals(keybinding)
    )
    if (!pending) return
    pendingUnsetKeybindings.value = pendingUnsetKeybindings.value.filter(
      (unset) => unset !== pending
    )
    addKeybinding(userUnsetKeybindings, keybinding, { existOk: true })
  }

  function addUserKeybinding(
    keybinding: KeybindingImpl,
    options: KeymapWriteOptions = {}
  ): KeymapChange {
    return writeUserBinding(currentChoices(), keybinding, options)
  }

  function userChoicesFromSaved({
    newBindings,
    unsetBindings
  }: SavedChoices): UserChoices {
    return newBindings.reduce(
      withUserBinding,
      unsetBindings.reduce(withUnsetChoice, EMPTY_USER_CHOICES)
    )
  }

  function applySavedChoices({
    newBindings,
    unsetBindings
  }: SavedChoices): KeymapChange {
    const conflict = findSavedChoiceConflicts(newBindings).at(0)
    if (conflict) return refuseConflict(conflict.existing, conflict.incoming)

    commitChoices(userChoicesFromSaved({ newBindings, unsetBindings }))
    return { ok: true, changed: true }
  }

  function restoreSavedChoices(saved: SavedChoices): KeybindingConflict[] {
    commitChoices(userChoicesFromSaved(saved))
    return findSavedChoiceConflicts(saved.newBindings)
  }

  function unsetKeybinding(keybinding: KeybindingImpl) {
    commitChoices(withoutBinding(currentChoices(), keybinding))
  }

  function updateKeybindingOnCommand(
    keybinding: KeybindingImpl,
    options: KeymapWriteOptions = {}
  ): KeymapChange {
    const currentKeybinding = getKeybindingByCommandId(keybinding.commandId)
    if (currentKeybinding?.equals(keybinding)) {
      return { ok: true, changed: false }
    }
    const base = currentKeybinding
      ? withoutBinding(currentChoices(), currentKeybinding)
      : currentChoices()
    return writeUserBinding(base, keybinding, options)
  }

  function resetAllKeybindings() {
    commitChoices(EMPTY_USER_CHOICES)
  }

  function removeAllKeybindingsForCommand(commandId: string): boolean {
    const currentBindings = getKeybindingsByCommandId(commandId)
    if (currentBindings.length === 0) return false
    commitChoices(withoutBindings(currentChoices(), currentBindings))
    return true
  }

  function updateSpecificKeybinding(
    oldBinding: KeybindingImpl,
    newBinding: KeybindingImpl,
    options: KeymapWriteOptions = {}
  ): KeymapChange {
    return writeUserBinding(
      withoutBinding(currentChoices(), oldBinding),
      newBinding,
      options
    )
  }

  function resetKeybindingForCommand(commandId: string): KeymapChange {
    const currentBindings = getKeybindingsByCommandId(commandId)
    const defaultBindings = defaultKeybindingsByCommandId.value[commandId] ?? []

    if (defaultBindings.length === 0) {
      if (currentBindings.length === 0) return { ok: true, changed: false }
      commitChoices(withoutBindings(currentChoices(), currentBindings))
      return { ok: true, changed: true }
    }

    if (!isCommandKeybindingModified(commandId)) {
      return { ok: true, changed: false }
    }

    const withoutCurrent = withoutBindings(currentChoices(), currentBindings)
    const candidate: UserChoices = {
      ...withoutCurrent,
      unset: defaultBindings.reduce(
        (unset, defaultBinding) =>
          withoutCombo(unset, defaultBinding.combo.serialize()),
        withoutCurrent.unset
      )
    }

    const keymap = effectiveKeymap(candidate)
    for (const defaultBinding of defaultBindings) {
      const holder = keymap[defaultBinding.combo.serialize()]
      if (holder && !holder.equals(defaultBinding)) {
        return refuseConflict(holder, defaultBinding)
      }
    }

    commitChoices(candidate)
    return { ok: true, changed: true }
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
    getUserKeybindingValues,
    getUserUnsetKeybindings,
    getUserUnsetKeybindingValues,
    getKeybinding,
    getKeybindingsByCommandId,
    getKeybindingByCommandId,
    addDefaultKeybinding,
    addUserKeybinding,
    applySavedChoices,
    restoreSavedChoices,
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
