import type { Keybinding } from '../types/keybinding'
import { KeyComboImpl } from './KeyCombo'

export class KeybindingImpl implements Keybinding {
  commandId: string
  combo: KeyComboImpl
  targetElementId?: string

  constructor(obj: Keybinding) {
    this.commandId = obj.commandId
    this.combo = new KeyComboImpl(obj.combo)
    this.targetElementId = obj.targetElementId
  }

  equals(other: unknown): boolean {
    return other instanceof KeybindingImpl
      ? this.commandId === other.commandId &&
          this.combo.equals(other.combo) &&
          this.targetElementId === other.targetElementId
      : false
  }
}
