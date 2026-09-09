import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSelectionOperations } from '@/composables/graph/useSelectionOperations'
import { app } from '@/scripts/app'

/**
 * `selectOnly` marks the canvas as a picking surface rather than an editable
 * one - the agent's node selection mode sets it. The guard lives at this call
 * site rather than inside litegraph, so that vendored library stays untouched;
 * the trade-off is that a new editing path has to opt in.
 */
vi.mock('@/scripts/app', () => ({
  app: { canvas: undefined as unknown }
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ prompt: vi.fn() })
}))

function stubCanvas(selectOnly: boolean) {
  const deleteSelected = vi.fn()
  const canvas = {
    selectOnly,
    selectedItems: new Set([{ id: 1 }]),
    deleteSelected,
    setDirty: vi.fn()
  }
  ;(app as unknown as { canvas: unknown }).canvas = canvas
  return { deleteSelected }
}

describe('useSelectionOperations delete guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('does not delete while the canvas is picking-only', () => {
    const { deleteSelected } = stubCanvas(true)

    useSelectionOperations().deleteSelection()

    expect(deleteSelected).not.toHaveBeenCalled()
  })

  it('deletes normally when the canvas is editable', () => {
    const { deleteSelected } = stubCanvas(false)

    useSelectionOperations().deleteSelection()

    expect(deleteSelected).toHaveBeenCalledOnce()
  })
})
