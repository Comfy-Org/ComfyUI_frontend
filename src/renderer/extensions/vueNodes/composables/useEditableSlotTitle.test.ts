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
    const { startEdit, commit, draft, editing } = useEditableSlotTitle(
      () => '1',
      () => 'color'
    )
    startEdit()
    expect(editing.value).toBe(true)
    expect(draft.value).toBe('color')
    draft.value = 'shade'
    commit()
    expect(editing.value).toBe(false)
    expect(h.node.renameVariableInput).toHaveBeenCalledWith('color', 'shade')
  })

  it('does not rename when the name is unchanged or blank', () => {
    h.node = renamableNode()
    const { startEdit, commit, draft } = useEditableSlotTitle(
      () => '1',
      () => 'color'
    )
    startEdit()
    draft.value = '  '
    commit()
    expect(h.node.renameVariableInput).not.toHaveBeenCalled()
  })

  it('discards the edit on cancel', () => {
    h.node = renamableNode()
    const { startEdit, cancel, draft, commit, editing } = useEditableSlotTitle(
      () => '1',
      () => 'color'
    )
    startEdit()
    draft.value = 'shade'
    cancel()
    expect(editing.value).toBe(false)
    commit()
    expect(h.node.renameVariableInput).not.toHaveBeenCalled()
  })
})
