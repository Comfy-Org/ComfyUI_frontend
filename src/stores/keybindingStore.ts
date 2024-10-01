import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { Keybinding, KeyCombo } from '@/types/keyBindingTypes'

export function serializeKeyCombo(combo: KeyCombo): string {
  return `${combo.key}:${combo.ctrl ?? false}:${combo.alt ?? false}:${combo.shift ?? false}:${combo.meta ?? false}`
}

export function deserializeKeyCombo(serialized: string): KeyCombo {
  const [key, ctrl, alt, shift, meta] = serialized.split(':')
  return {
    key,
    ctrl: ctrl === 'true',
    alt: alt === 'true',
    shift: shift === 'true',
    meta: meta === 'true'
  }
}

export const useKeybindingStore = defineStore('keybinding', () => {
  const keybindingsByCommandId = ref<Map<string, Keybinding[]>>(new Map())
  const keybindingByKeyCombo = ref<Map<string, Keybinding>>(new Map())
  const keybindings = computed<Keybinding[]>(() =>
    Array.from(keybindingByKeyCombo.value.values())
  )

  const getCommandKeybindings = (command: string) =>
    keybindingsByCommandId.value.get(command) ?? []

  function getKeybinding(combo: KeyCombo) {
    return keybindingByKeyCombo.value.get(serializeKeyCombo(combo))
  }

  function addKeybinding(keybinding: Keybinding) {
    if (getKeybinding(keybinding.combo)) {
      throw new Error(
        `Keybinding on ${keybinding.combo} already exists on ${getKeybinding(
          keybinding.combo
        )}`
      )
    }

    keybindingByKeyCombo.value.set(
      serializeKeyCombo(keybinding.combo),
      keybinding
    )

    const command = keybinding.commandId
    if (!keybindingsByCommandId.value.has(command)) {
      keybindingsByCommandId.value.set(command, [])
    }
    keybindingsByCommandId.value.get(command)?.push(keybinding)
  }

  function removeKeybinding(keybinding: Keybinding) {
    keybindingByKeyCombo.value.delete(serializeKeyCombo(keybinding.combo))
    const command = keybinding.commandId
    const commandKeybindings = keybindingsByCommandId.value.get(command)
    if (commandKeybindings) {
      keybindingsByCommandId.value.set(
        command,
        commandKeybindings.filter((kb) => kb.commandId !== keybinding.commandId)
      )
    }
  }

  return {
    keybindings,
    getCommandKeybindings,
    getKeybinding,
    addKeybinding,
    removeKeybinding
  }
})
