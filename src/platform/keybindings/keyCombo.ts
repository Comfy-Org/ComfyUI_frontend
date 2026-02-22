import { toRaw } from 'vue'

import { RESERVED_BY_TEXT_INPUT } from './reserved'
import type { KeyCombo } from './types'

export class KeyComboImpl implements KeyCombo {
  key: string
  code: string
  ctrl: boolean
  alt: boolean
  shift: boolean

  constructor(obj: KeyCombo) {
    this.key = obj.key
    this.code = obj.code ?? ''
    this.ctrl = obj.ctrl ?? false
    this.alt = obj.alt ?? false
    this.shift = obj.shift ?? false
  }

  static fromEvent(event: KeyboardEvent) {
    return new KeyComboImpl({
      key: event.key,
      code: event.code,
      ctrl: event.ctrlKey || event.metaKey,
      alt: event.altKey,
      shift: event.shiftKey
    })
  }

  equals(other: unknown): boolean {
    const raw = toRaw(other)

    if (!(raw instanceof KeyComboImpl)) {
      return false
    }

    const thisCode = this.code
    const otherCode = raw.code

    if (thisCode && otherCode) {
      return (
        thisCode === otherCode &&
        this.ctrl === raw.ctrl &&
        this.alt === raw.alt &&
        this.shift === raw.shift
      )
    }

    return (
      this.key.toUpperCase() === raw.key.toUpperCase() &&
      this.ctrl === raw.ctrl &&
      this.alt === raw.alt &&
      this.shift === raw.shift
    )
  }

  serialize(): string {
    const identity = this.code || this.key.toUpperCase()
    return `${identity}:${this.ctrl}:${this.alt}:${this.shift}`
  }

  toString(): string {
    return this.getKeySequences().join(' + ')
  }

  get hasModifier(): boolean {
    return this.ctrl || this.alt || this.shift
  }

  get isModifier(): boolean {
    return ['Control', 'Meta', 'Alt', 'Shift'].includes(this.key)
  }

  get modifierCount(): number {
    const modifiers = [this.ctrl, this.alt, this.shift]
    return modifiers.reduce((acc, cur) => acc + Number(cur), 0)
  }

  get isShiftOnly(): boolean {
    return this.shift && this.modifierCount === 1
  }

  get isReservedByTextInput(): boolean {
    return (
      !this.hasModifier ||
      this.isShiftOnly ||
      RESERVED_BY_TEXT_INPUT.has(this.toString())
    )
  }

  getKeySequences(): string[] {
    const sequences: string[] = []
    if (this.ctrl) {
      sequences.push('Ctrl')
    }
    if (this.alt) {
      sequences.push('Alt')
    }
    if (this.shift) {
      sequences.push('Shift')
    }
    sequences.push(this.key)
    return sequences
  }
}
