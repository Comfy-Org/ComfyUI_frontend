import { beforeEach, describe, expect, it } from 'vitest'

import { toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'

import {
  clearRevealedLinks,
  clearRootLinkReveals,
  isLinkRevealed,
  setRevealedLinks
} from './linkRevealState'

const ROOT_A = toRootGraphId('root-a')
const ROOT_B = toRootGraphId('root-b')

beforeEach(() => {
  clearRootLinkReveals(ROOT_A)
  clearRootLinkReveals(ROOT_B)
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

  it('ignores a stale owner clearing a newer reveal', () => {
    const previousOwner = {}
    const currentOwner = {}
    setRevealedLinks(ROOT_A, [toLinkId(3)], previousOwner)
    setRevealedLinks(ROOT_A, [toLinkId(4)], currentOwner)

    expect(clearRevealedLinks(previousOwner)).toBe(false)
    expect(isLinkRevealed(ROOT_A, toLinkId(4))).toBe(true)
  })

  it('clears an owner holding and an entire root', () => {
    const owner = {}
    setRevealedLinks(ROOT_A, [toLinkId(1)], owner)
    setRevealedLinks(ROOT_B, [toLinkId(2)], owner)

    expect(clearRevealedLinks(owner)).toBe(true)
    expect(isLinkRevealed(ROOT_A, toLinkId(1))).toBe(false)
    expect(isLinkRevealed(ROOT_B, toLinkId(2))).toBe(false)

    setRevealedLinks(ROOT_A, [toLinkId(1)], owner)
    expect(clearRootLinkReveals(ROOT_A)).toBe(true)
    expect(isLinkRevealed(ROOT_A, toLinkId(1))).toBe(false)
  })
})
