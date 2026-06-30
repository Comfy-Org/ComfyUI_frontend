import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isLinkRevealed,
  setRevealedLinks
} from '@/lib/litegraph/src/canvas/linkBadges'

import { useSlotNoodlePreview } from './useSlotNoodlePreview'

const mocks = vi.hoisted(() => ({
  getNodeById: vi.fn(),
  links: new Map<number, unknown>(),
  setDirty: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      graph: { getNodeById: mocks.getNodeById, links: mocks.links },
      setDirty: mocks.setDirty
    }
  }
}))

beforeEach(() => {
  setRevealedLinks([])
  mocks.links.clear()
  mocks.getNodeById.mockReturnValue({ id: 5 })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useSlotNoodlePreview', () => {
  it('reveals the hidden links on a hovered output slot, ignoring others', () => {
    mocks.links.set(1, { id: 1, hidden: true, origin_id: 5, origin_slot: 0 })
    mocks.links.set(2, { id: 2, hidden: false, origin_id: 5, origin_slot: 0 })
    mocks.links.set(3, { id: 3, hidden: true, origin_id: 5, origin_slot: 1 })
    mocks.links.set(4, { id: 4, hidden: true, origin_id: 9, origin_slot: 0 })

    useSlotNoodlePreview({
      nodeId: '5',
      index: 0,
      type: 'output'
    }).revealNoodles()

    expect(isLinkRevealed(1)).toBe(true) // hidden, same slot
    expect(isLinkRevealed(2)).toBe(false) // not hidden
    expect(isLinkRevealed(3)).toBe(false) // other slot
    expect(isLinkRevealed(4)).toBe(false) // other node
    expect(mocks.setDirty).toHaveBeenCalledWith(false, true)
  })

  it('reveals the hidden link on a hovered input slot', () => {
    mocks.links.set(7, { id: 7, hidden: true, target_id: 5, target_slot: 2 })

    useSlotNoodlePreview({
      nodeId: '5',
      index: 2,
      type: 'input'
    }).revealNoodles()

    expect(isLinkRevealed(7)).toBe(true)
  })

  it('clears the reveal on leave', () => {
    setRevealedLinks([9])

    useSlotNoodlePreview({
      nodeId: '5',
      index: 0,
      type: 'input'
    }).hideNoodles()

    expect(isLinkRevealed(9)).toBe(false)
    expect(mocks.setDirty).toHaveBeenCalledWith(false, true)
  })
})
