import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCoreCommands } from '@/composables/useCoreCommands'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCommandStore } from '@/stores/commandStore'

vi.mock(import('firebase/auth'))

const GRAPH_MUTATION_COMMANDS = [
  'Comfy.Canvas.DeleteSelectedItems',
  'Comfy.Canvas.MoveSelectedNodes.Down',
  'Comfy.Canvas.MoveSelectedNodes.Left',
  'Comfy.Canvas.MoveSelectedNodes.Right',
  'Comfy.Canvas.MoveSelectedNodes.Up',
  'Comfy.Canvas.PasteFromClipboard',
  'Comfy.Canvas.PasteFromClipboardWithConnect',
  'Comfy.Canvas.Resize',
  'Comfy.Canvas.ToggleSelected.Pin',
  'Comfy.Canvas.ToggleSelectedNodes.Bypass',
  'Comfy.Canvas.ToggleSelectedNodes.Collapse',
  'Comfy.Canvas.ToggleSelectedNodes.Mute',
  'Comfy.Canvas.ToggleSelectedNodes.Pin',
  'Comfy.ClearWorkflow',
  'Comfy.Graph.ConvertToSubgraph',
  'Comfy.Graph.FitGroupToContents',
  'Comfy.Graph.GroupSelectedNodes',
  'Comfy.Graph.ToggleWidgetPromotion',
  'Comfy.Graph.UnpackSubgraph',
  'Comfy.Redo',
  'Comfy.Subgraph.SetDescription',
  'Comfy.Subgraph.SetSearchAliases',
  'Comfy.Undo'
]

describe('useCoreCommands selection-only policy', () => {
  it('declares mutatesGraph on exactly the graph mutation commands', () => {
    const declared = useCoreCommands()
      .filter((command) => command.mutatesGraph !== undefined)
      .map((command) => command.id)
      .sort()

    expect(declared).toEqual(GRAPH_MUTATION_COMMANDS)
  })

  describe('undo and redo through the command store', () => {
    const tracker = { undo: vi.fn(), redo: vi.fn() }

    beforeEach(() => {
      useWorkflowStore().activeWorkflow = fromPartial<
        NonNullable<ReturnType<typeof useWorkflowStore>['activeWorkflow']>
      >({ changeTracker: tracker })
      useCommandStore().registerCommands(useCoreCommands())
    })

    it.for([
      { id: 'Comfy.Undo', history: 'undo', selectOnly: true, calls: 0 },
      { id: 'Comfy.Undo', history: 'undo', selectOnly: false, calls: 1 },
      { id: 'Comfy.Redo', history: 'redo', selectOnly: true, calls: 0 },
      { id: 'Comfy.Redo', history: 'redo', selectOnly: false, calls: 1 }
    ] as const)(
      '$id while selectOnly=$selectOnly runs the workflow tracker $calls times',
      async ({ id, history, selectOnly, calls }) => {
        useCommandStore().setInteractionMode({ isSelectOnly: () => selectOnly })

        await useCommandStore().execute(id)

        expect(tracker[history]).toHaveBeenCalledTimes(calls)
      }
    )
  })
})
