import { useKeybindingStore } from './keybindingStore'

/**
 * Canvas actions the agent routinely tells a user to perform by hand, mapped to
 * the command each one is bound to.
 *
 * The keys themselves are deliberately not written down here. They are read out
 * of the keybinding store when a reply renders, so a user who rebound an action
 * or loaded a preset is shown the key that actually works for them. A list of
 * keys in the agent's prompt cannot do that: it can only carry the shipped
 * default, it drifts from `defaults.ts` with nothing to catch it, and it is
 * re-billed on every turn whether or not shortcuts come up (DES-779).
 *
 * `canvasActionShortcuts.test.ts` holds every id here against the shipped
 * defaults, so renaming or unbinding a command fails there rather than silently
 * dropping the keycap from agent replies.
 */
export const CANVAS_ACTION_COMMAND_IDS = {
  bypass: 'Comfy.Canvas.ToggleSelectedNodes.Bypass',
  mute: 'Comfy.Canvas.ToggleSelectedNodes.Mute',
  collapse: 'Comfy.Canvas.ToggleSelectedNodes.Collapse',
  pin: 'Comfy.Canvas.ToggleSelected.Pin',
  group: 'Comfy.Graph.GroupSelectedNodes',
  subgraph: 'Comfy.Graph.ConvertToSubgraph',
  run: 'Comfy.QueuePrompt',
  queue: 'Comfy.QueuePrompt',
  interrupt: 'Comfy.Interrupt',
  save: 'Comfy.SaveWorkflow',
  'select all': 'Comfy.Canvas.SelectAll',
  'fit view': 'Comfy.Canvas.FitView',
  'zoom in': 'Comfy.Canvas.ZoomIn',
  'zoom out': 'Comfy.Canvas.ZoomOut'
} as const satisfies Record<string, string>

/**
 * A resolver for the keys a command is currently bound to, in the same words
 * the Keybindings settings panel shows (`['Ctrl', 'b']`), or undefined when
 * nothing is bound to it. User bindings and presets win over the defaults,
 * which is the whole reason to ask at render time rather than ship a list.
 *
 * Call it in setup and keep the returned function: it closes over the store so
 * callers never reach into it themselves.
 */
export function useCanvasActionShortcutKeys(): (
  commandId: string
) => string[] | undefined {
  const keybindingStore = useKeybindingStore()
  return (commandId) =>
    keybindingStore.getKeybindingByCommandId(commandId)?.combo.getKeySequences()
}
