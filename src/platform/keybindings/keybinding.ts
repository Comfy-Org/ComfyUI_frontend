import { toRaw } from 'vue'

import { KeyComboImpl } from './keyCombo'
import type { Keybinding } from './types'
import { canonicalWhenClause } from './whenClause'

export class KeybindingImpl implements Keybinding {
  commandId: string
  combo: KeyComboImpl
  targetElementId?: string
  dialogKey?: string
  when?: string
  allowRepeat?: boolean
  preventDefault?: boolean
  releaseCommandId?: string

  constructor(obj: Keybinding) {
    this.commandId = obj.commandId
    this.combo = new KeyComboImpl(obj.combo)
    this.targetElementId = obj.targetElementId || undefined
    this.dialogKey = obj.dialogKey || undefined
    this.when = obj.when ? canonicalWhenClause(obj.when) : undefined
    this.allowRepeat = obj.allowRepeat
    this.preventDefault = obj.preventDefault
    this.releaseCommandId = obj.releaseCommandId || undefined
  }

  /** Every field that distinguishes one binding from another. */
  serialize(): string {
    return JSON.stringify([
      this.commandId,
      this.combo.serialize(),
      this.targetElementId ?? '',
      this.dialogKey ?? '',
      this.when ?? '',
      this.allowRepeat ?? true,
      this.preventDefault ?? true,
      this.releaseCommandId ?? ''
    ])
  }

  equals(other: unknown): boolean {
    const raw = toRaw(other)

    return raw instanceof KeybindingImpl
      ? this.serialize() === raw.serialize()
      : false
  }
}
