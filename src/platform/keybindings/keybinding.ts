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

  constructor(obj: Keybinding) {
    this.commandId = obj.commandId
    this.combo = new KeyComboImpl(obj.combo)
    this.targetElementId = obj.targetElementId || undefined
    this.dialogKey = obj.dialogKey || undefined
    this.when = obj.when ? canonicalWhenClause(obj.when) : undefined
  }

  /** Every field that distinguishes one binding from another. */
  serialize(): string {
    return JSON.stringify([
      this.commandId,
      this.combo.serialize(),
      this.targetElementId ?? '',
      this.dialogKey ?? '',
      this.when ?? ''
    ])
  }

  equals(other: unknown): boolean {
    const raw = toRaw(other)

    return raw instanceof KeybindingImpl
      ? this.commandId === raw.commandId &&
          this.combo.equals(raw.combo) &&
          this.targetElementId === raw.targetElementId &&
          this.dialogKey === raw.dialogKey &&
          this.when === raw.when
      : false
  }
}
