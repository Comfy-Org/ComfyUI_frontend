import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useEditableSlotTitle } from '@/renderer/extensions/vueNodes/composables/useEditableSlotTitle'

const h = vi.hoisted(() => ({
  node: undefined as
    | { renameVariableInput: ReturnType<typeof vi.fn> }
    | undefined,
  toastAdd: vi.fn()
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: { graph: { getNodeById: () => h.node } }
  })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: h.toastAdd })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

function renamableNode() {
  return { renameVariableInput: vi.fn(() => true) }
}

beforeEach(() => {
  vi.clearAllMocks()
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
    expect(h.toastAdd).not.toHaveBeenCalled()
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

  it('warns when the rename is rejected', () => {
    h.node = { renameVariableInput: vi.fn(() => false) }
    const { startEdit, commit } = useEditableSlotTitle(
      () => '1',
      () => 'color'
    )
    startEdit()
    commit('taken')
    expect(h.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn' })
    )
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
