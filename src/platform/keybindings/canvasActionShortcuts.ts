import { KeybindingImpl } from '@comfyorg/keybindings/keybinding'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'

import { CORE_KEYBINDINGS } from './defaults'

const EQUIVALENT_MODIFIER: Record<string, string> = {
  CMD: 'CTRL',
  COMMAND: 'CTRL',
  CONTROL: 'CTRL',
  META: 'CTRL',
  '⌘': 'CTRL',
  OPTION: 'ALT',
  OPT: 'ALT',
  '⌥': 'ALT',
  '⇧': 'SHIFT'
}

const EQUIVALENT_KEY: Record<string, string> = {
  RETURN: 'ENTER',
  ESC: 'ESCAPE',
  DEL: 'DELETE',
  SPACEBAR: 'SPACE'
}

const MODIFIER_LABELS: Record<string, string> = {
  CTRL: 'Ctrl',
  ALT: 'Alt',
  SHIFT: 'Shift'
}

const MODIFIER_ORDER = ['CTRL', 'ALT', 'SHIFT']

function fold(key: string): string {
  const upper = key.toUpperCase()
  const modifier = EQUIVALENT_MODIFIER[upper] ?? upper
  return MODIFIER_ORDER.includes(modifier)
    ? modifier
    : (EQUIVALENT_KEY[upper] ?? upper)
}

/** This app's label for a modifier however it was spelled, else undefined. */
export function modifierLabel(key: string): string | undefined {
  return MODIFIER_LABELS[fold(key)]
}

/** One spelling for a combo, with modifiers ordered and synonyms folded. */
export function canonicalCombo(keys: string[]): string {
  const folded = keys.map(fold)
  const modifiers = MODIFIER_ORDER.filter((modifier) =>
    folded.includes(modifier)
  )
  const rest = folded.filter((key) => !MODIFIER_ORDER.includes(key))
  return [...modifiers, ...rest].join('+')
}

const COMMAND_ID_BY_DEFAULT_COMBO = new Map(
  CORE_KEYBINDINGS.map(
    (keybinding) => [new KeybindingImpl(keybinding).combo, keybinding] as const
  )
    .filter(([combo]) => combo.hasModifier)
    .map(([combo, keybinding]) => [
      canonicalCombo(combo.getKeySequences()),
      keybinding.commandId
    ])
)

/** The canvas command that ships `keys` as a default, else undefined. */
export function canvasCommandForWrittenKeys(
  keys: string[]
): string | undefined {
  return COMMAND_ID_BY_DEFAULT_COMBO.get(canonicalCombo(keys))
}

/** Returns a reader for every key sequence a command is bound to now. */
export function useCanvasActionShortcutKeys(): (
  commandId: string
) => string[][] {
  const keybindingStore = useKeybindingStore()
  return (commandId) =>
    keybindingStore
      .getKeybindingsByCommandId(commandId)
      .map((keybinding) => keybinding.combo.getKeySequences())
}
