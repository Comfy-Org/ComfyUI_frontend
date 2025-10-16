import type { KeyCombo, Keybinding } from '@/schemas/keyBindingSchema'

/**
 * Migration utility for converting old event.key format to new event.code format
 * This ensures backward compatibility for existing user keybindings
 */

// Map from old event.key format to new event.code format
const KEY_MIGRATION_MAP: Record<string, string> = {
  // Letters (both cases)
  a: 'KeyA',
  A: 'KeyA',
  b: 'KeyB',
  B: 'KeyB',
  c: 'KeyC',
  C: 'KeyC',
  d: 'KeyD',
  D: 'KeyD',
  e: 'KeyE',
  E: 'KeyE',
  f: 'KeyF',
  F: 'KeyF',
  g: 'KeyG',
  G: 'KeyG',
  h: 'KeyH',
  H: 'KeyH',
  i: 'KeyI',
  I: 'KeyI',
  j: 'KeyJ',
  J: 'KeyJ',
  k: 'KeyK',
  K: 'KeyK',
  l: 'KeyL',
  L: 'KeyL',
  m: 'KeyM',
  M: 'KeyM',
  n: 'KeyN',
  N: 'KeyN',
  o: 'KeyO',
  O: 'KeyO',
  p: 'KeyP',
  P: 'KeyP',
  q: 'KeyQ',
  Q: 'KeyQ',
  r: 'KeyR',
  R: 'KeyR',
  s: 'KeyS',
  S: 'KeyS',
  t: 'KeyT',
  T: 'KeyT',
  u: 'KeyU',
  U: 'KeyU',
  v: 'KeyV',
  V: 'KeyV',
  w: 'KeyW',
  W: 'KeyW',
  x: 'KeyX',
  X: 'KeyX',
  y: 'KeyY',
  Y: 'KeyY',
  z: 'KeyZ',
  Z: 'KeyZ',

  // Numbers
  '0': 'Digit0',
  '1': 'Digit1',
  '2': 'Digit2',
  '3': 'Digit3',
  '4': 'Digit4',
  '5': 'Digit5',
  '6': 'Digit6',
  '7': 'Digit7',
  '8': 'Digit8',
  '9': 'Digit9',

  // Special keys that might be in old format
  escape: 'Escape',
  enter: 'Enter',
  space: 'Space',
  tab: 'Tab',
  spacebar: 'Space',
  Spacebar: 'Space',
  esc: 'Escape',
  Esc: 'Escape',
  return: 'Enter',
  Return: 'Enter',
  backspace: 'Backspace',
  delete: 'Delete',

  // Arrow keys
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',

  // Function keys (already correct format but handle lowercase)
  f1: 'F1',
  f2: 'F2',
  f3: 'F3',
  f4: 'F4',
  f5: 'F5',
  f6: 'F6',
  f7: 'F7',
  f8: 'F8',
  f9: 'F9',
  f10: 'F10',
  f11: 'F11',
  f12: 'F12',

  // Punctuation and symbols (old name -> new code)
  '-': 'Minus',
  '=': 'Equal',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  ';': 'Semicolon',
  "'": 'Quote',
  '`': 'Backquote',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  _: 'Minus',
  '+': 'Equal',
  '{': 'BracketLeft',
  '}': 'BracketRight',
  '|': 'Backslash',
  ':': 'Semicolon',
  '"': 'Quote',
  '~': 'Backquote',
  '<': 'Comma',
  '>': 'Period',
  '?': 'Slash',

  // Shifted digits
  '!': 'Digit1',
  '@': 'Digit2',
  '#': 'Digit3',
  $: 'Digit4',
  '%': 'Digit5',
  '^': 'Digit6',
  '&': 'Digit7',
  '*': 'Digit8',
  '(': 'Digit9',
  ')': 'Digit0',

  // Common aliases
  ' ': 'Space'
}

/**
 * Checks if a key combo needs migration from old format to new format
 */
export function needsKeyMigration(keyCombo: KeyCombo): boolean {
  if (!keyCombo.key) return false

  // Check if it's already in the new format
  if (
    keyCombo.key.startsWith('Key') ||
    keyCombo.key.startsWith('Digit') ||
    (keyCombo.key.startsWith('F') && /^F\d+$/.test(keyCombo.key)) ||
    [
      'Enter',
      'Escape',
      'Tab',
      'Space',
      'Backspace',
      'Delete',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Minus',
      'Equal',
      'BracketLeft',
      'BracketRight',
      'Backslash',
      'Semicolon',
      'Quote',
      'Backquote',
      'Comma',
      'Period',
      'Slash',
      'NumpadAdd',
      'NumpadSubtract',
      'NumpadMultiply',
      'NumpadDivide'
    ].includes(keyCombo.key)
  ) {
    return false
  }

  // If it's in our migration map, it needs migration
  return keyCombo.key in KEY_MIGRATION_MAP
}

/**
 * Migrates a single key combo from old format to new format
 */
export function migrateKeyCombo(keyCombo: KeyCombo): KeyCombo {
  if (!needsKeyMigration(keyCombo)) {
    return keyCombo
  }

  const newKey = KEY_MIGRATION_MAP[keyCombo.key]
  if (!newKey) {
    console.warn(`Unknown key format for migration: ${keyCombo.key}`)
    return keyCombo
  }

  return {
    ...keyCombo,
    key: newKey
  }
}

/**
 * Migrates a single keybinding
 */
export function migrateKeybinding(keybinding: Keybinding): Keybinding {
  return {
    ...keybinding,
    combo: migrateKeyCombo(keybinding.combo)
  }
}

/**
 * Migrates an array of keybindings and returns both the migrated keybindings
 * and whether any migration was performed
 */
export function migrateKeybindings(keybindings: Keybinding[] | undefined): {
  keybindings: Keybinding[]
  migrated: boolean
} {
  if (!Array.isArray(keybindings)) {
    return {
      keybindings: [],
      migrated: false
    }
  }

  let migrated = false
  const migratedKeybindings = keybindings.map((keybinding) => {
    const migratedKeybinding = migrateKeybinding(keybinding)
    if (migratedKeybinding.combo.key !== keybinding.combo.key) {
      migrated = true
    }
    return migratedKeybinding
  })

  return {
    keybindings: migratedKeybindings,
    migrated
  }
}

/**
 * Normalizes a key to the event.code format
 * This handles both old and new formats
 */
export function normalizeKey(key: string): string {
  const migrated = migrateKeyCombo({ key } as KeyCombo)
  return migrated.key
}
