import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSelectionOperations } from '@/composables/graph/useSelectionOperations'

const {
  canvas,
  toastAdd,
  captureCanvasState,
  updateSelectedItems,
  prompt,
  titleEditor,
  store
} = vi.hoisted(() => ({
  canvas: {
    selectedItems: new Set<unknown>(),
    copyToClipboard: vi.fn(),
    pasteFromClipboard: vi.fn(),
    deleteSelected: vi.fn(),
    setDirty: vi.fn()
  },
  toastAdd: vi.fn(),
  captureCanvasState: vi.fn(),
  updateSelectedItems: vi.fn(),
  prompt: vi.fn(),
  titleEditor: { titleEditorTarget: null as unknown },
  store: { selectedItems: [] as unknown[] }
}))

vi.mock('@/scripts/app', () => ({ app: { canvas } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: toastAdd })
}))
vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: { changeTracker: { captureCanvasState } }
  })
}))
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    updateSelectedItems,
    get selectedItems() {
      return store.selectedItems
    }
  }),
  useTitleEditorStore: () => titleEditor
}))
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ prompt })
}))

beforeEach(() => {
  canvas.selectedItems = new Set()
  canvas.copyToClipboard.mockReset()
  canvas.pasteFromClipboard.mockReset()
  canvas.deleteSelected.mockReset()
  canvas.setDirty.mockReset()
  toastAdd.mockReset()
  captureCanvasState.mockReset()
  updateSelectedItems.mockReset()
  prompt.mockReset()
  titleEditor.titleEditorTarget = null
  store.selectedItems = []
})

describe('useSelectionOperations', () => {
  it('warns and does nothing when copying an empty selection', () => {
    useSelectionOperations().copySelection()
    expect(canvas.copyToClipboard).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn' })
    )
  })

  it('copies a non-empty selection and reports success', () => {
    canvas.selectedItems = new Set(['a'])
    useSelectionOperations().copySelection()
    expect(canvas.copyToClipboard).toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('pastes from clipboard and captures canvas state', () => {
    useSelectionOperations().pasteSelection()
    expect(canvas.pasteFromClipboard).toHaveBeenCalledWith({
      connectInputs: false
    })
    expect(captureCanvasState).toHaveBeenCalled()
  })

  it('duplicates by copy, clear, paste', () => {
    canvas.selectedItems = new Set(['a'])
    useSelectionOperations().duplicateSelection()
    expect(canvas.copyToClipboard).toHaveBeenCalled()
    expect(canvas.selectedItems.size).toBe(0)
    expect(updateSelectedItems).toHaveBeenCalled()
    expect(canvas.pasteFromClipboard).toHaveBeenCalled()
    expect(captureCanvasState).toHaveBeenCalled()
  })

  it('warns when duplicating nothing', () => {
    useSelectionOperations().duplicateSelection()
    expect(canvas.copyToClipboard).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn' })
    )
  })

  it('deletes a non-empty selection and marks the canvas dirty', () => {
    canvas.selectedItems = new Set(['a'])
    useSelectionOperations().deleteSelection()
    expect(canvas.deleteSelected).toHaveBeenCalled()
    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
    expect(captureCanvasState).toHaveBeenCalled()
  })

  it('warns when deleting nothing', () => {
    useSelectionOperations().deleteSelection()
    expect(canvas.deleteSelected).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn' })
    )
  })

  it('routes a single node rename to the title editor', async () => {
    const node = new LGraphNode('Test')
    store.selectedItems = [node]

    await useSelectionOperations().renameSelection()

    expect(titleEditor.titleEditorTarget).toBe(node)
    expect(prompt).not.toHaveBeenCalled()
  })

  it('renames a single non-node item via the prompt dialog', async () => {
    const group = { title: 'Old' }
    store.selectedItems = [group]
    prompt.mockResolvedValue('New')

    await useSelectionOperations().renameSelection()

    expect(group.title).toBe('New')
    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
    expect(captureCanvasState).toHaveBeenCalled()
  })

  it('batch-renames multiple items with an indexed base name', async () => {
    const a = { title: 'a' }
    const b = { title: 'b' }
    store.selectedItems = [a, b]
    prompt.mockResolvedValue('Item')

    await useSelectionOperations().renameSelection()

    expect(a.title).toBe('Item 1')
    expect(b.title).toBe('Item 2')
    expect(canvas.setDirty).toHaveBeenCalledWith(true, true)
    expect(captureCanvasState).toHaveBeenCalled()
  })

  it('warns when renaming an empty selection', async () => {
    await useSelectionOperations().renameSelection()
    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn' })
    )
  })
})
