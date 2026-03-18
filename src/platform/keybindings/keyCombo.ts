import { toRaw } from 'vue'

import { RESERVED_BY_BROWSER, RESERVED_BY_TEXT_INPUT } from './reserved'
import type { KeyCombo } from './types'

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
      key: resolveKeyFromEvent(event),
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
    return ['Control', 'Meta', 'Alt', 'Shift'].includes(this.key)
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

const CODE_TO_KEY: Record<string, string> = {
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Minus: '-',
  Equal: '='
}

/**
 * When modifier keys (Ctrl, Alt, Meta) are held, event.key may return
 * unexpected characters:
 * - macOS Option (Alt) produces special chars (e.g., Alt+M → µ, Alt+S → ß)
 * - Non-English layouts return localized chars (e.g., Ctrl+S → Ctrl+ы in Russian)
 *
 * Use event.code to resolve the physical key in these cases.
 *
 * Shift is excluded from the modifier check because it intentionally changes
 * the produced character (e.g., Shift+1 = !, Shift+a = A).
 */
function resolveKeyFromEvent(event: KeyboardEvent): string {
  if ((event.ctrlKey || event.altKey || event.metaKey) && event.code) {
    const { code } = event
    if (code.startsWith('Key')) return code.slice(3).toLowerCase()
    if (code.startsWith('Digit')) return code.slice(5)
    if (code in CODE_TO_KEY) return CODE_TO_KEY[code]
  }
  return event.key
}

function toNormalizedString(combo: KeyComboImpl): string {
  const sequences: string[] = []
  if (combo.ctrl) sequences.push('Ctrl')
  if (combo.alt) sequences.push('Alt')
  if (combo.shift) sequences.push('Shift')
  sequences.push(combo.key.length === 1 ? combo.key.toLowerCase() : combo.key)
  return sequences.join(' + ')
}
