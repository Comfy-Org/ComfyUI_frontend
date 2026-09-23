import { describe, expect, it, vi } from 'vitest'

import { useSelectionOperations } from '@/composables/graph/useSelectionOperations'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

/**
 * `selectOnly` marks the canvas as a picking surface rather than an editable
 * one - the agent's node selection mode sets it. The guard lives at this call
 * site rather than inside litegraph, so that vendored library stays untouched;
 * the trade-off is that a new editing path has to opt in.
 */
vi.mock(import('@/scripts/app'))

vi.mock(import('@/services/dialogService'))

function stubCanvas(selectOnly: boolean) {
  app.canvas.selectOnly = selectOnly
  app.canvas.selectedItems = new Set([new LGraphNode('Selected')])
  const deleteSelected = vi.mocked(app.canvas.deleteSelected)
  return { deleteSelected }
}

describe('useSelectionOperations delete guard', () => {
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
