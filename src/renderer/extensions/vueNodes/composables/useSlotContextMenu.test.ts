import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGraph, mockCanvas } = vi.hoisted(() => {
  const mockGraph = {
    getNodeById: vi.fn(),
    beforeChange: vi.fn(),
    afterChange: vi.fn()
  }
  const mockCanvas = {
    graph: mockGraph as typeof mockGraph | null,
    setDirty: vi.fn()
  }
  return { mockGraph, mockCanvas }
})

vi.mock('@/scripts/app', () => ({
  app: { canvas: mockCanvas }
}))

import { canRenameSlot, renameSlot } from './useSlotContextMenu'

describe('canRenameSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.graph = mockGraph
  })

  it('returns false when graph is null', () => {
    mockCanvas.graph = null
    expect(canRenameSlot({ nodeId: '1', slotIndex: 0, isInput: true })).toBe(
      false
    )
  })

  it('returns false when node is not found', () => {
    mockGraph.getNodeById.mockReturnValue(null)
    expect(canRenameSlot({ nodeId: '99', slotIndex: 0, isInput: true })).toBe(
      false
    )
  })

  it('returns true for a normal input slot', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: null, name: 'image' }],
      outputs: []
    })
    expect(canRenameSlot({ nodeId: '1', slotIndex: 0, isInput: true })).toBe(
      true
    )
  })

  it('returns true for a normal output slot', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [],
      outputs: [{ type: 'IMAGE', links: [], name: 'image' }]
    })
    expect(canRenameSlot({ nodeId: '1', slotIndex: 0, isInput: false })).toBe(
      true
    )
  })

  it('returns false when slot is nameLocked', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: null, name: 'image', nameLocked: true }],
      outputs: []
    })
    expect(canRenameSlot({ nodeId: '1', slotIndex: 0, isInput: true })).toBe(
      false
    )
  })

  it('returns false when input slot has a widget', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [
        { type: 'INT', link: 5, name: 'steps', widget: { name: 'steps' } }
      ],
      outputs: []
    })
    expect(canRenameSlot({ nodeId: '1', slotIndex: 0, isInput: true })).toBe(
      false
    )
  })

  it('returns false when slot index is out of range', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [],
      outputs: []
    })
    expect(canRenameSlot({ nodeId: '1', slotIndex: 5, isInput: true })).toBe(
      false
    )
  })
})

describe('renameSlot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.graph = mockGraph
  })

  it('does nothing when graph is null', () => {
    mockCanvas.graph = null
    renameSlot({ nodeId: '1', slotIndex: 0, isInput: true }, 'new')
    expect(mockGraph.beforeChange).not.toHaveBeenCalled()
  })

  it('does nothing when node is not found', () => {
    mockGraph.getNodeById.mockReturnValue(null)
    renameSlot({ nodeId: '99', slotIndex: 0, isInput: true }, 'new')
    expect(mockGraph.beforeChange).not.toHaveBeenCalled()
  })

  it('renames an input slot label', () => {
    const inputSlot = { type: 'IMAGE', link: null, name: 'image', label: '' }
    mockGraph.getNodeById.mockReturnValue({
      getInputInfo: () => inputSlot,
      getOutputInfo: () => null
    })

    renameSlot({ nodeId: '1', slotIndex: 0, isInput: true }, 'my_image')

    expect(inputSlot.label).toBe('my_image')
    expect(mockGraph.beforeChange).toHaveBeenCalled()
    expect(mockGraph.afterChange).toHaveBeenCalled()
    expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('renames an output slot label', () => {
    const outputSlot = {
      type: 'MODEL',
      links: [],
      name: 'model',
      label: ''
    }
    mockGraph.getNodeById.mockReturnValue({
      getInputInfo: () => null,
      getOutputInfo: () => outputSlot
    })

    renameSlot({ nodeId: '1', slotIndex: 0, isInput: false }, 'my_model')

    expect(outputSlot.label).toBe('my_model')
    expect(mockGraph.beforeChange).toHaveBeenCalled()
    expect(mockGraph.afterChange).toHaveBeenCalled()
  })

  it('does nothing when slot info is null', () => {
    mockGraph.getNodeById.mockReturnValue({
      getInputInfo: () => null,
      getOutputInfo: () => null
    })

    renameSlot({ nodeId: '1', slotIndex: 0, isInput: true }, 'new')
    expect(mockGraph.beforeChange).not.toHaveBeenCalled()
  })
})
