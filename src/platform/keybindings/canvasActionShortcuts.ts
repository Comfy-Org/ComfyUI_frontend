import { CORE_KEYBINDINGS } from './defaults'
import { KeybindingImpl } from './keybinding'
import { useKeybindingStore } from './keybindingStore'

const CANVAS_ACTION_COMMAND_IDS = new Set([
  'Comfy.Canvas.ToggleSelectedNodes.Bypass',
  'Comfy.Canvas.ToggleSelectedNodes.Mute',
  'Comfy.Canvas.ToggleSelectedNodes.Collapse',
  'Comfy.Canvas.ToggleSelected.Pin',
  'Comfy.Graph.GroupSelectedNodes',
  'Comfy.Graph.ConvertToSubgraph',
  'Comfy.QueuePrompt',
  'Comfy.Interrupt',
  'Comfy.SaveWorkflow',
  'Comfy.Canvas.SelectAll',
  'Comfy.Canvas.FitView',
  'Comfy.Canvas.ZoomIn',
  'Comfy.Canvas.ZoomOut'
])

const EQUIVALENT_MODIFIER: Record<string, string> = {
  CMD: 'CTRL',
  COMMAND: 'CTRL',
  CONTROL: 'CTRL',
  '⌘': 'CTRL',
  OPTION: 'ALT',
  OPT: 'ALT',
  '⌥': 'ALT',
  '⇧': 'SHIFT'
}

function canonical(keys: string[]): string {
  return keys
    .map((key) => key.toUpperCase())
    .map((key) => EQUIVALENT_MODIFIER[key] ?? key)
    .join('+')
}

const COMMAND_ID_BY_DEFAULT_COMBO = new Map(
  CORE_KEYBINDINGS.filter((keybinding) =>
    CANVAS_ACTION_COMMAND_IDS.has(keybinding.commandId)
  ).map((keybinding) => [
    canonical(new KeybindingImpl(keybinding).combo.getKeySequences()),
    keybinding.commandId
  ])
)

/**
 * The canvas command whose shipped default is `keys`, or undefined when no
 * canvas action ships that combo. MacOS spellings fold onto the labels this app
 * uses, which name Meta `Ctrl` and Option `Alt`.
 */
export function canvasCommandForWrittenKeys(
  keys: string[]
): string | undefined {
  return COMMAND_ID_BY_DEFAULT_COMBO.get(canonical(keys))
}

/**
 * Returns a resolver for the key labels a command is currently bound to, as the
 * Keybindings settings panel shows them, or undefined when it is unbound.
 */
export function useCanvasActionShortcutKeys(): (
  commandId: string
) => string[] | undefined {
  const keybindingStore = useKeybindingStore()
  return (commandId) =>
    keybindingStore.getKeybindingByCommandId(commandId)?.combo.getKeySequences()
}
