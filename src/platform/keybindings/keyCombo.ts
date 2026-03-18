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
 * Always resolve the physical key from event.code when available.
 *
 * Like VS Code's FallbackKeyboardMapper, keybindings are bound to physical
 * key positions (US layout), not the characters they produce. This ensures
 * shortcuts work on any keyboard layout:
 * - Non-Latin layouts (Russian, Arabic): physical 'R' fires 'к'/'ق' in
 *   event.key, but event.code is always 'KeyR' → resolved to 'r'
 * - macOS Alt produces special chars (Alt+M → µ): resolved from code
 * - US International Ctrl+Alt combos produce accented chars (Ctrl+Alt+A → á)
 *
 * Keys not in the mapping (Enter, Escape, F-keys, arrows, numpad) fall
 * through to event.key, which is locale-independent for these keys.
 */
function resolveKeyFromEvent(event: KeyboardEvent): string {
  if (event.code) {
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
