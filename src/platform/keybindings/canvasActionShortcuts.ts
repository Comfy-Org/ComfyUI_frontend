import { useKeybindingStore } from './keybindingStore'

/** Canvas action phrases an agent reply may use, mapped to the command each runs. */
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
