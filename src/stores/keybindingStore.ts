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
  const keybindingByKeyCombo = ref<Map<string, Keybinding>>(new Map())
  const keybindings = computed<Keybinding[]>(() =>
    Array.from(keybindingByKeyCombo.value.values())
  )

  function getKeybinding(combo: KeyCombo) {
    return keybindingByKeyCombo.value.get(serializeKeyCombo(combo))
  }

  function addKeybinding(
    keybinding: Keybinding,
    { existOk = false }: { existOk: boolean }
  ) {
    if (!existOk && getKeybinding(keybinding.combo)) {
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
  }

  function removeKeybinding(keybinding: Keybinding) {
    keybindingByKeyCombo.value.delete(serializeKeyCombo(keybinding.combo))
  }

  return {
    keybindings,
    getKeybinding,
    addKeybinding,
    removeKeybinding
  }
})
