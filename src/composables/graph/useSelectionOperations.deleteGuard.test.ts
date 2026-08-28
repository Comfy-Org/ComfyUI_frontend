import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSelectionOperations } from '@/composables/graph/useSelectionOperations'
import { app } from '@/scripts/app'

const canvasStore = vi.hoisted(() => ({
  selectedItems: new Set<unknown>(),
  titleEditorTarget: null as unknown,
  updateSelectedItems: vi.fn()
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => canvasStore,
  useTitleEditorStore: () => canvasStore
}))

vi.mock('@/scripts/app', () => ({
  app: { canvas: undefined as unknown }
}))

const prompt = vi.hoisted(() => vi.fn())
vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ prompt })
}))

function stubCanvas(selectOnly: boolean) {
  const selectedItem = { id: 1, title: 'Original' }
  const selectedItems = new Set([selectedItem])
  const copyToClipboard = vi.fn()
  const deleteSelected = vi.fn()
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
  canvasStore.selectedItems = selectedItems
  return {
    copyToClipboard,
    deleteSelected,
    pasteFromClipboard,
    selectedItem,
    selectedItems,
    setDirty
  }
}

describe('useSelectionOperations selection-only guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    canvasStore.selectedItems = new Set()
    canvasStore.titleEditorTarget = null
  })

  it('does not paste while the canvas is picking-only', () => {
    const { pasteFromClipboard } = stubCanvas(true)

    useSelectionOperations().pasteSelection()

    expect(pasteFromClipboard).not.toHaveBeenCalled()
  })

  it('does not copy, clear, or paste a duplicate while picking-only', () => {
    const { copyToClipboard, pasteFromClipboard, selectedItem, selectedItems } =
      stubCanvas(true)

    useSelectionOperations().duplicateSelection()

    expect(copyToClipboard).not.toHaveBeenCalled()
    expect(pasteFromClipboard).not.toHaveBeenCalled()
    expect([...selectedItems]).toEqual([selectedItem])
    expect(canvasStore.updateSelectedItems).not.toHaveBeenCalled()
  })

  it('does not delete while the canvas is picking-only', () => {
    const { deleteSelected, setDirty } = stubCanvas(true)

    useSelectionOperations().deleteSelection()

    expect(deleteSelected).not.toHaveBeenCalled()
    expect(setDirty).not.toHaveBeenCalled()
  })

  it('does not open rename UI or change a title while picking-only', async () => {
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
    expect(canvasStore.updateSelectedItems).toHaveBeenCalledOnce()
    expect(pasteFromClipboard).toHaveBeenCalledWith({ connectInputs: false })
  })

  it('deletes normally when the canvas is editable', () => {
    const { deleteSelected, setDirty } = stubCanvas(false)

    useSelectionOperations().deleteSelection()

    expect(deleteSelected).toHaveBeenCalledOnce()
    expect(setDirty).toHaveBeenCalledWith(true, true)
  })

  it('renames normally when the canvas is editable', async () => {
    const { selectedItem, setDirty } = stubCanvas(false)
    prompt.mockResolvedValue('Renamed')

    await useSelectionOperations().renameSelection()

    expect(prompt).toHaveBeenCalledOnce()
    expect(selectedItem.title).toBe('Renamed')
    expect(setDirty).toHaveBeenCalledWith(true, true)
  })
})
