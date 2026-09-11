import { markRaw } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSelectionOperations } from '@/composables/graph/useSelectionOperations'
import { LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  useCanvasStore,
  useTitleEditorStore
} from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: { canvas: undefined as unknown }
}))

const prompt = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/services/dialogService'), () => ({
  useDialogService: () => ({ prompt })
}))

function stubCanvas(selectOnly: boolean) {
  const selectedItem = new LGraphGroup('Original')
  const selectedItems = new Set<LGraphGroup | LGraphNode>([selectedItem])
  const copyToClipboard = vi.fn()
  const deleteSelected = vi.fn(() => selectedItems.clear())
  const pasteFromClipboard = vi.fn()
  const setDirty = vi.fn()
  const canvas = {
    selectOnly,
    selectedItems,
    copyToClipboard,
    deleteSelected,
    pasteFromClipboard,
    setDirty
  }
  ;(app as unknown as { canvas: unknown }).canvas = canvas
  select(selectedItems)
  return {
    copyToClipboard,
    deleteSelected,
    pasteFromClipboard,
    selectedItem,
    selectedItems,
    setDirty
  }
}

function select(items: Iterable<LGraphGroup | LGraphNode>) {
  useCanvasStore().selectedItems = [...items].map((item) => markRaw(item))
}

describe('useSelectionOperations selection-only guards', () => {
  beforeEach(() => {
    useCanvasStore().selectedItems = []
    useTitleEditorStore().titleEditorTarget = null
  })

  // INV-CANVAS-01/03: remove `.fails` when select-only blocks paste.
  it.fails('does not paste while the canvas is picking-only', () => {
    const { pasteFromClipboard } = stubCanvas(true)

    useSelectionOperations().pasteSelection()

    expect(pasteFromClipboard).not.toHaveBeenCalled()
  })

  // INV-CANVAS-01/03: remove `.fails` when select-only blocks duplication.
  it.fails('does not copy, clear, or paste a duplicate while picking-only', () => {
    const { copyToClipboard, pasteFromClipboard, selectedItem, selectedItems } =
      stubCanvas(true)

    useSelectionOperations().duplicateSelection()

    expect(copyToClipboard).not.toHaveBeenCalled()
    expect(pasteFromClipboard).not.toHaveBeenCalled()
    expect([...selectedItems]).toEqual([selectedItem])
    expect(useCanvasStore().updateSelectedItems).not.toHaveBeenCalled()
  })

  it('does not delete while the canvas is picking-only', () => {
    const { deleteSelected, selectedItem, selectedItems, setDirty } =
      stubCanvas(true)

    useSelectionOperations().deleteSelection()

    expect(deleteSelected).not.toHaveBeenCalled()
    expect(setDirty).not.toHaveBeenCalled()
    expect([...selectedItems]).toEqual([selectedItem])
  })

  // INV-CANVAS-01/03: remove `.fails` when select-only blocks rename prompts.
  it.fails('does not open rename UI or change a title while picking-only', async () => {
    const { selectedItem, setDirty } = stubCanvas(true)
    prompt.mockResolvedValue('Renamed')

    await useSelectionOperations().renameSelection()

    expect(prompt).not.toHaveBeenCalled()
    expect(selectedItem.title).toBe('Original')
    expect(setDirty).not.toHaveBeenCalled()
  })

  it('pastes normally when the canvas is editable', () => {
    const { pasteFromClipboard } = stubCanvas(false)

    useSelectionOperations().pasteSelection()

    expect(pasteFromClipboard).toHaveBeenCalledWith({ connectInputs: false })
  })

  it('duplicates normally when the canvas is editable', () => {
    const { copyToClipboard, pasteFromClipboard, selectedItems } =
      stubCanvas(false)

    useSelectionOperations().duplicateSelection()

    expect(copyToClipboard).toHaveBeenCalledOnce()
    expect(selectedItems.size).toBe(0)
    expect(useCanvasStore().updateSelectedItems).toHaveBeenCalledOnce()
    expect(pasteFromClipboard).toHaveBeenCalledWith({ connectInputs: false })
  })

  it('deletes normally when the canvas is editable', () => {
    const { deleteSelected, selectedItems, setDirty } = stubCanvas(false)

    useSelectionOperations().deleteSelection()

    expect(deleteSelected).toHaveBeenCalledOnce()
    expect(selectedItems.size).toBe(0)
    expect(setDirty).toHaveBeenCalledWith(true, true)
  })

  // INV-CANVAS-01/03: remove `.fails` when select-only blocks title editing.
  it.fails('does not open the node title editor while picking-only', async () => {
    stubCanvas(true)
    const node = new LGraphNode('Node')
    select([node])

    await useSelectionOperations().renameSelection()

    expect(useTitleEditorStore().titleEditorTarget).toBeNull()
  })

  it('opens the node title editor when the canvas is editable', async () => {
    stubCanvas(false)
    const node = new LGraphNode('Node')
    select([node])

    await useSelectionOperations().renameSelection()

    expect(useTitleEditorStore().titleEditorTarget).toBe(node)
  })

  it('renames normally when the canvas is editable', async () => {
    const { selectedItem, setDirty } = stubCanvas(false)
    prompt.mockResolvedValue('Renamed')

    await useSelectionOperations().renameSelection()

    expect(prompt).toHaveBeenCalledOnce()
    expect(selectedItem.title).toBe('Renamed')
    expect(setDirty).toHaveBeenCalledWith(true, true)
  })

  // INV-CANVAS-01/03: remove `.fails` when rename rechecks select-only after await.
  it.fails('does not rename when picking starts while the prompt is open', async () => {
    const { selectedItem, setDirty } = stubCanvas(false)
    let finishPrompt: (value: string) => void = () => {}
    prompt.mockReturnValue(
      new Promise((resolve) => {
        finishPrompt = resolve
      })
    )

    const pending = useSelectionOperations().renameSelection()
    Reflect.set(app.canvas, 'selectOnly', true)
    finishPrompt('Renamed')
    await pending

    expect(selectedItem.title).toBe('Original')
    expect(setDirty).not.toHaveBeenCalled()
  })
})
