import { beforeEach, describe, expect, it } from 'vitest'

import { toLinkId } from '@/types/linkId'

import {
  addRevealedLinks,
  isLinkRevealed,
  removeRevealedLinks,
  setRevealedLinks
} from './linkRevealState'

beforeEach(() => {
  setRevealedLinks([])
})

describe('linkRevealState', () => {
  it('changes only when revealed link membership changes', () => {
    expect(setRevealedLinks([toLinkId(5), toLinkId(6)])).toBe(true)
    expect(isLinkRevealed(toLinkId(5))).toBe(true)
    expect(isLinkRevealed(toLinkId(6))).toBe(true)
    expect(isLinkRevealed(toLinkId(7))).toBe(false)
    expect(setRevealedLinks([toLinkId(6), toLinkId(5)])).toBe(false)
    expect(setRevealedLinks([toLinkId(5), toLinkId(6), toLinkId(7)])).toBe(true)
    expect(isLinkRevealed(toLinkId(7))).toBe(true)
    expect(setRevealedLinks([])).toBe(true)
    expect(isLinkRevealed(toLinkId(5))).toBe(false)
  })

  it('adds and removes only the requested revealed links', () => {
    setRevealedLinks([toLinkId(5)])

    expect(addRevealedLinks([toLinkId(6)])).toBe(true)
    expect(addRevealedLinks([toLinkId(5), toLinkId(6)])).toBe(false)
    expect(removeRevealedLinks([toLinkId(7)])).toBe(false)
    expect(removeRevealedLinks([toLinkId(5)])).toBe(true)
    expect(isLinkRevealed(toLinkId(5))).toBe(false)
    expect(isLinkRevealed(toLinkId(6))).toBe(true)
  })
})
