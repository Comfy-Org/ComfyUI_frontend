import { beforeEach, describe, expect, it } from 'vitest'

import { toLinkId } from '@/types/linkId'

import {
  isLinkRevealed,
  linkVisibilityState,
  setRevealedLinks
} from './linkVisibilityState'

beforeEach(() => {
  setRevealedLinks([])
})

describe('linkVisibilityState', () => {
  it('changes only when revealed link membership changes', () => {
    expect(setRevealedLinks([toLinkId(5), toLinkId(6)])).toBe(true)
    expect(isLinkRevealed(toLinkId(5))).toBe(true)
    expect(isLinkRevealed(toLinkId(6))).toBe(true)
    expect(isLinkRevealed(toLinkId(7))).toBe(false)
    expect(setRevealedLinks([toLinkId(6), toLinkId(5)])).toBe(false)
    expect(setRevealedLinks([toLinkId(5), toLinkId(6), toLinkId(7)])).toBe(true)
    expect(linkVisibilityState.revealedLinkIds.has(toLinkId(7))).toBe(true)
    expect(setRevealedLinks([])).toBe(true)
    expect(isLinkRevealed(toLinkId(5))).toBe(false)
  })
})
