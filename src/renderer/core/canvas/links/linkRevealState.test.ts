import { beforeEach, describe, expect, it } from 'vitest'

import { toLinkId } from '@/types/linkId'

import {
  clearRevealedLinks,
  isLinkRevealed,
  resetLinkReveals,
  setRevealedLinks
} from './linkRevealState'

const ROOT_A = 'root-a'
const ROOT_B = 'root-b'

beforeEach(() => {
  resetLinkReveals()
})

describe('linkRevealState', () => {
  it('replaces an owner holding and reports effective changes', () => {
    const owner = {}

    expect(setRevealedLinks(ROOT_A, [toLinkId(5), toLinkId(6)], owner)).toBe(
      true
    )
    expect(isLinkRevealed(ROOT_A, toLinkId(5))).toBe(true)
    expect(isLinkRevealed(ROOT_A, toLinkId(7))).toBe(false)

    expect(setRevealedLinks(ROOT_A, [toLinkId(6), toLinkId(5)], owner)).toBe(
      false
    )

    expect(setRevealedLinks(ROOT_A, [toLinkId(6)], owner)).toBe(true)
    expect(isLinkRevealed(ROOT_A, toLinkId(5))).toBe(false)
    expect(isLinkRevealed(ROOT_A, toLinkId(6))).toBe(true)
  })

  it('scopes reveals by root so equal ids in other workflows never collide', () => {
    const ownerA = {}
    const ownerB = {}
    setRevealedLinks(ROOT_A, [toLinkId(1)], ownerA)

    expect(isLinkRevealed(ROOT_B, toLinkId(1))).toBe(false)

    setRevealedLinks(ROOT_B, [], ownerB)
    setRevealedLinks(ROOT_B, [toLinkId(1)], ownerB)
    clearRevealedLinks(ownerB)

    expect(isLinkRevealed(ROOT_A, toLinkId(1))).toBe(true)
  })

  it('keeps a link revealed while any owner still holds it', () => {
    const slotOwner = {}
    const canvasOwner = {}
    setRevealedLinks(ROOT_A, [toLinkId(3)], slotOwner)
    setRevealedLinks(ROOT_A, [toLinkId(3)], canvasOwner)

    expect(clearRevealedLinks(slotOwner)).toBe(false)
    expect(isLinkRevealed(ROOT_A, toLinkId(3))).toBe(true)

    expect(clearRevealedLinks(canvasOwner)).toBe(true)
    expect(isLinkRevealed(ROOT_A, toLinkId(3))).toBe(false)
  })

  it('clearing an owner releases its holdings in every root', () => {
    const owner = {}
    setRevealedLinks(ROOT_A, [toLinkId(1)], owner)
    setRevealedLinks(ROOT_B, [toLinkId(2)], owner)

    expect(clearRevealedLinks(owner)).toBe(true)

    expect(isLinkRevealed(ROOT_A, toLinkId(1))).toBe(false)
    expect(isLinkRevealed(ROOT_B, toLinkId(2))).toBe(false)
    expect(clearRevealedLinks(owner)).toBe(false)
  })
})
