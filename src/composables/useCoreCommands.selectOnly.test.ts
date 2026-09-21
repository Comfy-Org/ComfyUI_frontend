import { describe, expect, it, vi } from 'vitest'

import { useCoreCommands } from '@/composables/useCoreCommands'

vi.mock(import('firebase/auth'))

describe('useCoreCommands selection-only policy', () => {
  it('marks every graph mutation command for centralized enforcement', () => {
    const commands = new Map(
      useCoreCommands().map((command) => [command.id, command])
    )
    const graphMutationCommandIds = [
      'Comfy.Undo',
      'Comfy.Redo',
      'Comfy.ClearWorkflow',
      'Comfy.Graph.GroupSelectedNodes',
      'Comfy.Canvas.ToggleSelectedNodes.Mute',
      'Comfy.Canvas.ToggleSelectedNodes.Bypass',
      'Comfy.Canvas.ToggleSelectedNodes.Pin',
      'Comfy.Canvas.ToggleSelected.Pin',
      'Comfy.Canvas.Resize',
      'Comfy.Canvas.ToggleSelectedNodes.Collapse',
      'Comfy.Graph.FitGroupToContents',
      'Comfy.Canvas.PasteFromClipboard',
      'Comfy.Canvas.PasteFromClipboardWithConnect',
      'Comfy.Canvas.DeleteSelectedItems',
      'Comfy.Canvas.MoveSelectedNodes.Up',
      'Comfy.Canvas.MoveSelectedNodes.Down',
      'Comfy.Canvas.MoveSelectedNodes.Left',
      'Comfy.Canvas.MoveSelectedNodes.Right',
      'Comfy.Graph.ConvertToSubgraph',
      'Comfy.Graph.UnpackSubgraph',
      'Comfy.Graph.ToggleWidgetPromotion'
    ]

    expect(
      graphMutationCommandIds.map((id) => [id, commands.get(id)?.mutatesGraph])
    ).toEqual(graphMutationCommandIds.map((id) => [id, expect.anything()]))
  })
})
