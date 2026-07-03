import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useEditableSlotTitle } from '@/renderer/extensions/vueNodes/composables/useEditableSlotTitle'

const h = vi.hoisted(() => ({
  node: undefined as
    | { renameVariableInput: ReturnType<typeof vi.fn> }
    | undefined
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: { graph: { getNodeById: () => h.node } }
  })
}))

function renamableNode() {
  return { renameVariableInput: vi.fn() }
}

beforeEach(() => {
  h.node = undefined
})

describe('useEditableSlotTitle', () => {
  it('is not editable when the node does not support renaming', () => {
    h.node = undefined
    const { isEditable, startEdit, editing } = useEditableSlotTitle(
      () => '1',
      () => 'color'
    )
    expect(isEditable.value).toBe(false)
    startEdit()
    expect(editing.value).toBe(false)
  })

  it('renames the slot on commit when the value changed', () => {
    h.node = renamableNode()
    const { startEdit, commit, editing } = useEditableSlotTitle(
      () => '1',
      () => 'color'
    )
    startEdit()
    expect(editing.value).toBe(true)
    commit('shade')
    expect(editing.value).toBe(false)
    expect(h.node.renameVariableInput).toHaveBeenCalledWith('color', 'shade')
  })

  it('does not rename when the name is unchanged or blank', () => {
    h.node = renamableNode()
    const { startEdit, commit } = useEditableSlotTitle(
      () => '1',
      () => 'color'
    )
    startEdit()
    commit('  ')
    startEdit()
    commit('color')
    expect(h.node.renameVariableInput).not.toHaveBeenCalled()
  })

  it('discards the edit on cancel', () => {
    h.node = renamableNode()
    const { startEdit, cancel, commit, editing } = useEditableSlotTitle(
      () => '1',
      () => 'color'
    )
    startEdit()
    cancel()
    expect(editing.value).toBe(false)
    commit('shade')
    expect(h.node.renameVariableInput).not.toHaveBeenCalled()
  })
})
