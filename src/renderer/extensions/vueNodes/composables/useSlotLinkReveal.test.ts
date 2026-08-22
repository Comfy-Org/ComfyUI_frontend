import { effectScope } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LLink } from '@/lib/litegraph/src/LLink'
import {
  isLinkRevealed,
  setRevealedLinks
} from '@/renderer/core/canvas/links/linkRevealState'
import type { LinkId } from '@/types/linkId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import { useSlotLinkReveal } from './useSlotLinkReveal'

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

function createReveal(options: Parameters<typeof useSlotLinkReveal>[0]) {
  const scope = effectScope()
  const reveal = scope.run(() => useSlotLinkReveal(options))
  if (!reveal) throw new Error('Failed to create slot link reveal')
  return { reveal, scope }
}

beforeEach(() => {
  mocks.links.clear()
  mocks.setDirty.mockClear()
  setRevealedLinks([])
})

describe('useSlotLinkReveal', () => {
  it('reveals only hidden links on the hovered output slot', () => {
    addLink(1, 0, 0, 8, 0, true)
    addLink(2, 0, 0, 9, 0, false)
    addLink(3, 0, 1, 10, 0, true)
    addLink(4, 6, 0, 11, 0, true)

    const { reveal, scope } = createReveal({
      nodeId: toNodeId(0),
      index: 0,
      type: 'output'
    })
    reveal.revealLinks()

    expect(isLinkRevealed(toLinkId(1))).toBe(true)
    expect(isLinkRevealed(toLinkId(2))).toBe(false)
    expect(isLinkRevealed(toLinkId(3))).toBe(false)
    expect(isLinkRevealed(toLinkId(4))).toBe(false)
    expect(mocks.setDirty).toHaveBeenCalledWith(false, true)
    scope.stop()
  })

  it('reveals only hidden links on the hovered input slot', () => {
    addLink(7, 1, 0, 5, 2, true)
    addLink(8, 2, 0, 5, 1, true)
    addLink(9, 3, 0, 6, 2, true)

    const { reveal, scope } = createReveal({
      nodeId: toNodeId(5),
      index: 2,
      type: 'input'
    })
    reveal.revealLinks()

    expect(isLinkRevealed(toLinkId(7))).toBe(true)
    expect(isLinkRevealed(toLinkId(8))).toBe(false)
    expect(isLinkRevealed(toLinkId(9))).toBe(false)
    scope.stop()
  })

  it('clears only its owned revealed links when the pointer leaves', () => {
    setRevealedLinks([toLinkId(9)])
    addLink(10, 1, 0, 5, 2, true)

    const { reveal, scope } = createReveal({
      nodeId: toNodeId(5),
      index: 2,
      type: 'input'
    })
    reveal.revealLinks()
    reveal.unrevealLinks()

    expect(isLinkRevealed(toLinkId(9))).toBe(true)
    expect(isLinkRevealed(toLinkId(10))).toBe(false)
    expect(mocks.setDirty).toHaveBeenCalledWith(false, true)
    scope.stop()
  })

  it('clears its owned revealed links when the slot scope is disposed', () => {
    addLink(10, 1, 0, 5, 2, true)
    const { reveal, scope } = createReveal({
      nodeId: toNodeId(5),
      index: 2,
      type: 'input'
    })
    reveal.revealLinks()
    expect(isLinkRevealed(toLinkId(10))).toBe(true)
    mocks.setDirty.mockClear()

    scope.stop()

    expect(isLinkRevealed(toLinkId(10))).toBe(false)
    expect(mocks.setDirty).toHaveBeenCalledWith(false, true)
  })

  it('does not clear another slot reveal when an unrelated scope is disposed', () => {
    addLink(10, 1, 0, 5, 2, true)
    const active = createReveal({
      nodeId: toNodeId(5),
      index: 2,
      type: 'input'
    })
    const unrelated = createReveal({
      nodeId: toNodeId(8),
      index: 0,
      type: 'output'
    })
    active.reveal.revealLinks()
    mocks.setDirty.mockClear()

    unrelated.scope.stop()

    expect(isLinkRevealed(toLinkId(10))).toBe(true)
    expect(mocks.setDirty).not.toHaveBeenCalled()
    active.scope.stop()
  })
})
