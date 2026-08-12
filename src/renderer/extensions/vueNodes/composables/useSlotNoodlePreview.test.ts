import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LLink } from '@/lib/litegraph/src/LLink'
import {
  isLinkRevealed,
  setRevealedLinks
} from '@/renderer/core/canvas/links/linkVisibilityState'
import type { LinkId } from '@/types/linkId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { useSlotNoodlePreview } from './useSlotNoodlePreview'

const mocks = vi.hoisted(() => ({
  links: new Map<LinkId, LLink>(),
  setDirty: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      graph: { links: mocks.links },
      setDirty: mocks.setDirty
    }
  }
}))

function addLink(
  id: number,
  originNode: number,
  originSlot: number,
  targetNode: number,
  targetSlot: number,
  hidden: boolean
): void {
  const link = new LLink(
    toLinkId(id),
    'MODEL',
    originNode,
    originSlot,
    targetNode,
    targetSlot
  )
  link.hidden = hidden
  mocks.links.set(link.id, link)
}

beforeEach(() => {
  mocks.links.clear()
  setRevealedLinks([])
})

describe('useSlotNoodlePreview', () => {
  it('reveals only hidden links on the hovered output slot', () => {
    addLink(1, 0, 0, 8, 0, true)
    addLink(2, 0, 0, 9, 0, false)
    addLink(3, 0, 1, 10, 0, true)
    addLink(4, 6, 0, 11, 0, true)

    useSlotNoodlePreview({
      nodeId: toNodeId(0),
      index: 0,
      type: 'output'
    }).revealNoodles()

    expect(isLinkRevealed(toLinkId(1))).toBe(true)
    expect(isLinkRevealed(toLinkId(2))).toBe(false)
    expect(isLinkRevealed(toLinkId(3))).toBe(false)
    expect(isLinkRevealed(toLinkId(4))).toBe(false)
    expect(mocks.setDirty).toHaveBeenCalledWith(false, true)
  })

  it('reveals only hidden links on the hovered input slot', () => {
    addLink(7, 1, 0, 5, 2, true)
    addLink(8, 2, 0, 5, 1, true)
    addLink(9, 3, 0, 6, 2, true)

    useSlotNoodlePreview({
      nodeId: toNodeId(5),
      index: 2,
      type: 'input'
    }).revealNoodles()

    expect(isLinkRevealed(toLinkId(7))).toBe(true)
    expect(isLinkRevealed(toLinkId(8))).toBe(false)
    expect(isLinkRevealed(toLinkId(9))).toBe(false)
  })

  it('clears revealed links when the pointer leaves', () => {
    setRevealedLinks([toLinkId(9)])

    useSlotNoodlePreview({
      nodeId: toNodeId(5),
      index: 0,
      type: 'input'
    }).hideNoodles()

    expect(isLinkRevealed(toLinkId(9))).toBe(false)
    expect(mocks.setDirty).toHaveBeenCalledWith(false, true)
  })
})
