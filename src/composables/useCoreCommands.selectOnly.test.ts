import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCoreCommands } from '@/composables/useCoreCommands'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCommandPolicyStore } from '@/stores/commandPolicyStore'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useMaskEditorStore } from '@/stores/maskEditorStore'

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
      { id: 'Comfy.Undo', history: 'undo', locked: true, calls: 0 },
      { id: 'Comfy.Undo', history: 'undo', locked: false, calls: 1 },
      { id: 'Comfy.Redo', history: 'redo', locked: true, calls: 0 },
      { id: 'Comfy.Redo', history: 'redo', locked: false, calls: 1 }
    ] as const)(
      '$id with graphMutationsLocked=$locked runs the workflow tracker $calls times',
      async ({ id, history, locked, calls }) => {
        useCommandPolicyStore().graphMutationsLocked = locked

        await useCommandStore().execute(id)

        expect(tracker[history]).toHaveBeenCalledTimes(calls)
      }
    )

    it.for([
      { id: 'Comfy.Undo', history: 'undo' },
      { id: 'Comfy.Redo', history: 'redo' }
    ] as const)(
      '$id while locked still runs the open mask editor history $history',
      async ({ id, history }) => {
        vi.mocked(useDialogStore().isDialogOpen).mockImplementation(
          (key) => key === 'global-mask-editor'
        )
        const maskHistory = vi
          .spyOn(useMaskEditorStore().canvasHistory, history)
          .mockImplementation(() => {})
        useCommandPolicyStore().graphMutationsLocked = true

        await useCommandStore().execute(id)

        expect(maskHistory).toHaveBeenCalledOnce()
        expect(tracker[history]).not.toHaveBeenCalled()
      }
    )

    it.for([
      { id: 'Comfy.Undo', history: 'undo' },
      { id: 'Comfy.Redo', history: 'redo' }
    ] as const)(
      '$id while locked runs the history the mask editor state at dispatch selects, even if the editor closes before the promise resumes',
      async ({ id, history }) => {
        const isDialogOpen = vi.mocked(useDialogStore().isDialogOpen)
        isDialogOpen.mockImplementation((key) => key === 'global-mask-editor')
        const maskHistory = vi
          .spyOn(useMaskEditorStore().canvasHistory, history)
          .mockImplementation(() => {})
        useCommandPolicyStore().graphMutationsLocked = true

        const execution = useCommandStore().execute(id)
        isDialogOpen.mockReturnValue(false)
        await execution

        expect(maskHistory).toHaveBeenCalledOnce()
        expect(tracker[history]).not.toHaveBeenCalled()
      }
    )
  })
})
