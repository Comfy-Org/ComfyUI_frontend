import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGraph, mockCanvas } = vi.hoisted(() => {
  const mockGraph = {
    getNodeById: vi.fn(),
    beforeChange: vi.fn(),
    afterChange: vi.fn(),
    trigger: vi.fn()
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

import {
  canDisconnectSlot,
  canRemoveSlot,
  canRenameSlot,
  disconnectSlotLinks,
  hasAnySlotAction,
  removeSlot,
  renameSlot
} from './slotMenuService'

describe(canRenameSlot, () => {
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

  it('returns false when node not found', () => {
    mockGraph.getNodeById.mockReturnValue(null)
    expect(canRenameSlot({ nodeId: '99', slotIndex: 0, isInput: true })).toBe(
      false
    )
  })

  it('returns true for normal input slot', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: null, name: 'image' }],
      outputs: []
    })
    expect(canRenameSlot({ nodeId: '1', slotIndex: 0, isInput: true })).toBe(
      true
    )
  })

  it('returns true for normal output slot', () => {
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

  it('returns false when slot index out of range', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [],
      outputs: []
    })
    expect(canRenameSlot({ nodeId: '1', slotIndex: 5, isInput: true })).toBe(
      false
    )
  })
})

describe(canDisconnectSlot, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.graph = mockGraph
  })

  it('returns false when graph is null', () => {
    mockCanvas.graph = null
    expect(
      canDisconnectSlot({ nodeId: '1', slotIndex: 0, isInput: true })
    ).toBe(false)
  })

  it('returns true for input with link', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: 42, name: 'image' }],
      outputs: []
    })
    expect(
      canDisconnectSlot({ nodeId: '1', slotIndex: 0, isInput: true })
    ).toBe(true)
  })

  it('returns false for input without link', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: null, name: 'image' }],
      outputs: []
    })
    expect(
      canDisconnectSlot({ nodeId: '1', slotIndex: 0, isInput: true })
    ).toBe(false)
  })

  it('returns true for output with links', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [],
      outputs: [{ type: 'IMAGE', links: [1, 2], name: 'image' }]
    })
    expect(
      canDisconnectSlot({ nodeId: '1', slotIndex: 0, isInput: false })
    ).toBe(true)
  })

  it('returns false for output with empty links array', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [],
      outputs: [{ type: 'IMAGE', links: [], name: 'image' }]
    })
    expect(
      canDisconnectSlot({ nodeId: '1', slotIndex: 0, isInput: false })
    ).toBe(false)
  })

  it('returns false for output with null links', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [],
      outputs: [{ type: 'IMAGE', links: null, name: 'image' }]
    })
    expect(
      canDisconnectSlot({ nodeId: '1', slotIndex: 0, isInput: false })
    ).toBe(false)
  })
})

describe(canRemoveSlot, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.graph = mockGraph
  })

  it('returns false when graph is null', () => {
    mockCanvas.graph = null
    expect(canRemoveSlot({ nodeId: '1', slotIndex: 0, isInput: true })).toBe(
      false
    )
  })

  it('returns true when removable is true and not locked', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: null, name: 'image', removable: true }],
      outputs: []
    })
    expect(canRemoveSlot({ nodeId: '1', slotIndex: 0, isInput: true })).toBe(
      true
    )
  })

  it('returns false when removable is false', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: null, name: 'image', removable: false }],
      outputs: []
    })
    expect(canRemoveSlot({ nodeId: '1', slotIndex: 0, isInput: true })).toBe(
      false
    )
  })

  it('returns false when locked is true', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [
        {
          type: 'IMAGE',
          link: null,
          name: 'image',
          removable: true,
          locked: true
        }
      ],
      outputs: []
    })
    expect(canRemoveSlot({ nodeId: '1', slotIndex: 0, isInput: true })).toBe(
      false
    )
  })
})

describe(hasAnySlotAction, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.graph = mockGraph
  })

  it('returns true when rename is available', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: null, name: 'image' }],
      outputs: []
    })
    expect(hasAnySlotAction({ nodeId: '1', slotIndex: 0, isInput: true })).toBe(
      true
    )
  })

  it('returns true when disconnect is available', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: 42, name: 'image', nameLocked: true }],
      outputs: []
    })
    expect(hasAnySlotAction({ nodeId: '1', slotIndex: 0, isInput: true })).toBe(
      true
    )
  })

  it('returns false when no action available', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [
        {
          type: 'IMAGE',
          link: null,
          name: 'image',
          nameLocked: true,
          removable: false
        }
      ],
      outputs: []
    })
    expect(hasAnySlotAction({ nodeId: '1', slotIndex: 0, isInput: true })).toBe(
      false
    )
  })
})

describe(renameSlot, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.graph = mockGraph
  })

  it('does nothing when graph is null', () => {
    mockCanvas.graph = null
    renameSlot({ nodeId: '1', slotIndex: 0, isInput: true }, 'new')
    expect(mockGraph.beforeChange).not.toHaveBeenCalled()
  })

  it('does nothing when nameLocked', () => {
    const inputSlot = {
      type: 'IMAGE',
      link: null,
      name: 'image',
      label: '',
      nameLocked: true
    }
    mockGraph.getNodeById.mockReturnValue({
      inputs: [inputSlot],
      outputs: [],
      getInputInfo: () => inputSlot,
      getOutputInfo: () => null
    })

    renameSlot({ nodeId: '1', slotIndex: 0, isInput: true }, 'new')
    expect(mockGraph.beforeChange).not.toHaveBeenCalled()
    expect(inputSlot.label).toBe('')
  })

  it('renames an input slot label', () => {
    const inputSlot = { type: 'IMAGE', link: null, name: 'image', label: '' }
    mockGraph.getNodeById.mockReturnValue({
      inputs: [inputSlot],
      outputs: []
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
      inputs: [],
      outputs: [outputSlot]
    })

    renameSlot({ nodeId: '1', slotIndex: 0, isInput: false }, 'my_model')

    expect(outputSlot.label).toBe('my_model')
    expect(mockGraph.beforeChange).toHaveBeenCalled()
    expect(mockGraph.afterChange).toHaveBeenCalled()
  })

  it('does nothing when slot not found', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [],
      outputs: []
    })

    renameSlot({ nodeId: '1', slotIndex: 0, isInput: true }, 'new')
    expect(mockGraph.beforeChange).not.toHaveBeenCalled()
  })
})

describe(disconnectSlotLinks, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.graph = mockGraph
  })

  it('does nothing when graph is null', () => {
    mockCanvas.graph = null
    disconnectSlotLinks({ nodeId: '1', slotIndex: 0, isInput: true })
    expect(mockGraph.beforeChange).not.toHaveBeenCalled()
  })

  it('disconnects an input slot', () => {
    const disconnectInput = vi.fn()
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: 42, name: 'image' }],
      outputs: [],
      disconnectInput
    })

    disconnectSlotLinks({ nodeId: '1', slotIndex: 0, isInput: true })

    expect(mockGraph.beforeChange).toHaveBeenCalled()
    expect(disconnectInput).toHaveBeenCalledWith(0, true)
    expect(mockGraph.afterChange).toHaveBeenCalled()
    expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('disconnects an output slot', () => {
    const disconnectOutput = vi.fn()
    mockGraph.getNodeById.mockReturnValue({
      inputs: [],
      outputs: [{ type: 'IMAGE', links: [1, 2], name: 'image' }],
      disconnectOutput
    })

    disconnectSlotLinks({ nodeId: '1', slotIndex: 0, isInput: false })

    expect(mockGraph.beforeChange).toHaveBeenCalled()
    expect(disconnectOutput).toHaveBeenCalledWith(0)
    expect(mockGraph.afterChange).toHaveBeenCalled()
    expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('triggers slot refresh event after disconnect', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: 42, name: 'image' }],
      outputs: [],
      disconnectInput: vi.fn()
    })

    disconnectSlotLinks({ nodeId: '1', slotIndex: 0, isInput: true })

    expect(mockGraph.trigger).toHaveBeenCalledWith('node:slot-label:changed', {
      nodeId: '1'
    })
  })
})

describe(removeSlot, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanvas.graph = mockGraph
  })

  it('does nothing when graph is null', () => {
    mockCanvas.graph = null
    removeSlot({ nodeId: '1', slotIndex: 0, isInput: true })
    expect(mockGraph.beforeChange).not.toHaveBeenCalled()
  })

  it('removes an input slot', () => {
    const removeInput = vi.fn()
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: null, name: 'image', removable: true }],
      outputs: [],
      removeInput
    })

    removeSlot({ nodeId: '1', slotIndex: 0, isInput: true })

    expect(mockGraph.beforeChange).toHaveBeenCalled()
    expect(removeInput).toHaveBeenCalledWith(0)
    expect(mockGraph.afterChange).toHaveBeenCalled()
    expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('removes an output slot', () => {
    const removeOutput = vi.fn()
    mockGraph.getNodeById.mockReturnValue({
      inputs: [],
      outputs: [{ type: 'IMAGE', links: [], name: 'image', removable: true }],
      removeOutput
    })

    removeSlot({ nodeId: '1', slotIndex: 0, isInput: false })

    expect(mockGraph.beforeChange).toHaveBeenCalled()
    expect(removeOutput).toHaveBeenCalledWith(0)
    expect(mockGraph.afterChange).toHaveBeenCalled()
    expect(mockCanvas.setDirty).toHaveBeenCalledWith(true, true)
  })

  it('does nothing when not removable', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: null, name: 'image', removable: false }],
      outputs: []
    })

    removeSlot({ nodeId: '1', slotIndex: 0, isInput: true })
    expect(mockGraph.beforeChange).not.toHaveBeenCalled()
  })

  it('triggers slot refresh event after remove', () => {
    mockGraph.getNodeById.mockReturnValue({
      inputs: [{ type: 'IMAGE', link: null, name: 'image', removable: true }],
      outputs: [],
      removeInput: vi.fn()
    })

    removeSlot({ nodeId: '1', slotIndex: 0, isInput: true })

    expect(mockGraph.trigger).toHaveBeenCalledWith('node:slot-label:changed', {
      nodeId: '1'
    })
  })
})
