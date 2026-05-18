import { toRaw } from 'vue'

import { RESERVED_BY_BROWSER, RESERVED_BY_TEXT_INPUT } from './reserved'
import type { KeyCombo } from './types'

const MODIFIER_KEY_LABELS: Record<string, string> = {
  Control: 'Ctrl',
  Meta: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift'
}

export class KeyComboImpl implements KeyCombo {
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean

  constructor(obj: KeyCombo) {
    this.key = obj.key
    this.ctrl = obj.ctrl ?? false
    this.alt = obj.alt ?? false
    this.shift = obj.shift ?? false
  }

  static fromEvent(event: KeyboardEvent) {
    return new KeyComboImpl({
      key: event.key,
      ctrl: event.ctrlKey || event.metaKey,
      alt: event.altKey,
      shift: event.shiftKey
    })
  }

  equals(other: unknown): boolean {
    const raw = toRaw(other)

    return raw instanceof KeyComboImpl
      ? this.key.toUpperCase() === raw.key.toUpperCase() &&
          this.ctrl === raw.ctrl &&
          this.alt === raw.alt &&
          this.shift === raw.shift
      : false
  }

  serialize(): string {
    return `${this.key.toUpperCase()}:${this.ctrl}:${this.alt}:${this.shift}`
  }

  toString(): string {
    return this.getKeySequences().join(' + ')
  }

  get hasModifier(): boolean {
    return this.ctrl || this.alt || this.shift
  }

  get isModifier(): boolean {
    return this.key in MODIFIER_KEY_LABELS
  }

  get modifierCount(): number {
    const modifiers = [this.ctrl, this.alt, this.shift]
    return modifiers.reduce((acc, cur) => acc + Number(cur), 0)
  }

  get isShiftOnly(): boolean {
    return this.shift && this.modifierCount === 1
  }

  get isBrowserReserved(): boolean {
    return RESERVED_BY_BROWSER.has(toNormalizedString(this))
  }

  get isReservedByTextInput(): boolean {
    return (
      !this.hasModifier ||
      this.isShiftOnly ||
      RESERVED_BY_TEXT_INPUT.has(toNormalizedString(this))
    )
  }

  getKeySequences(): string[] {
    const sequences = getModifierSequences(this)

    if (!this.isModifier || sequences.length === 0) {
      sequences.push(getKeyLabel(this.key))
    }

    return sequences
  }
}

function toNormalizedString(combo: KeyComboImpl): string {
  const sequences = getModifierSequences(combo)

  if (!combo.isModifier || sequences.length === 0) {
    sequences.push(getKeyLabel(combo.key, true))
  }

  return sequences.join(' + ')
}

function getModifierSequences(combo: KeyComboImpl): string[] {
  const sequences: string[] = []
  if (combo.ctrl) sequences.push('Ctrl')
  if (combo.alt) sequences.push('Alt')
  if (combo.shift) sequences.push('Shift')
  return sequences
}

function getKeyLabel(key: string, normalizeSingleCharacter = false): string {
  const label = MODIFIER_KEY_LABELS[key] ?? key
  return normalizeSingleCharacter && label.length === 1
    ? label.toLowerCase()
    : label
}
