import { describe, expect, it } from 'vitest'

import { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'

/**
 * `selectOnly` marks the canvas as a picking surface rather than an editing one
 * - the agent's node selection mode sets it. Deleting is an edit, and every
 * delete path (the command, the keybinding and the selection toolbox) funnels
 * through `deleteSelected`, so the guard belongs here rather than at each call
 * site.
 *
 * A graph-less canvas is the probe: without the guard the method reaches
 * `NullGraphError`, so "did not throw" proves it returned early.
 */
function deleteSelectedOn(selectOnly: boolean) {
  const canvas = { selectOnly, graph: null }
  return () => LGraphCanvas.prototype.deleteSelected.call(canvas as never)
}

describe('LGraphCanvas.deleteSelected', () => {
  it('does nothing while the canvas is in select-only mode', () => {
    expect(deleteSelectedOn(true)).not.toThrow()
  })

  it('still proceeds when the canvas is editable', () => {
    expect(deleteSelectedOn(false)).toThrow()
  })
})
