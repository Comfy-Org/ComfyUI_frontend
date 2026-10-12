import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'

import {
  LINK_HIDE_TRANSITION,
  cancelLinkHideTransition,
  hasLinkHideTransitions,
  linkHideDashPattern,
  linkHideLabelScale,
  linkHideTransitionAlpha,
  startLinkHideTransitions
} from './linkHideTransition'

const ROOT = toRootGraphId('root')
const LINK_A = toLinkId(1)
const LINK_B = toLinkId(2)
const { holdMs, fadeMs, labelPopMs, labelPopFromScale } = LINK_HIDE_TRANSITION
const LINE_END = holdMs + fadeMs
const END = LINE_END + labelPopMs

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('reduce')
    }))
  )
}

beforeEach(() => stubReducedMotion(false))

afterEach(() => {
  cancelLinkHideTransition(ROOT, LINK_A)
  cancelLinkHideTransition(ROOT, LINK_B)
  vi.unstubAllGlobals()
})

describe('linkHideTransition', () => {
  it('holds fully opaque, fades, then expires', () => {
    startLinkHideTransitions(ROOT, [LINK_A], 0)

    expect(linkHideTransitionAlpha(ROOT, LINK_A, holdMs)).toBe(1)
    expect(linkHideTransitionAlpha(ROOT, LINK_A, holdMs + fadeMs / 2)).toBe(0.5)
    expect(linkHideTransitionAlpha(ROOT, LINK_A, LINE_END)).toBeUndefined()
    expect(hasLinkHideTransitions(ROOT, END - 1)).toBe(true)
    expect(hasLinkHideTransitions(ROOT, END)).toBe(false)
  })

  it('pops the labels in once the line has faded', () => {
    startLinkHideTransitions(ROOT, [LINK_A], 0)

    expect(linkHideLabelScale(ROOT, LINK_A, LINE_END)).toBeCloseTo(
      labelPopFromScale
    )
    expect(
      linkHideLabelScale(ROOT, LINK_A, LINE_END + labelPopMs / 2)
    ).toBeGreaterThan(1)
    expect(linkHideLabelScale(ROOT, LINK_A, END)).toBe(1)
  })

  it('animates a batch together', () => {
    startLinkHideTransitions(ROOT, [LINK_A, LINK_B], 0)

    expect(linkHideTransitionAlpha(ROOT, LINK_A, holdMs + 50)).toBe(
      linkHideTransitionAlpha(ROOT, LINK_B, holdMs + 50)
    )
  })

  it('stops redrawing once every transition has expired unread', () => {
    startLinkHideTransitions(ROOT, [LINK_A], 0)

    expect(hasLinkHideTransitions(ROOT, END)).toBe(false)
  })

  it('cancels one link without touching the rest of its batch', () => {
    startLinkHideTransitions(ROOT, [LINK_A, LINK_B], 0)

    expect(cancelLinkHideTransition(ROOT, LINK_A)).toBe(true)
    expect(linkHideTransitionAlpha(ROOT, LINK_A, 10)).toBeUndefined()
    expect(linkHideTransitionAlpha(ROOT, LINK_B, 10)).toBe(1)
    expect(cancelLinkHideTransition(ROOT, LINK_A)).toBe(false)
  })

  it('skips the transition under reduced motion', () => {
    stubReducedMotion(true)

    startLinkHideTransitions(ROOT, [LINK_A], 0)

    expect(linkHideTransitionAlpha(ROOT, LINK_A, 0)).toBeUndefined()
    expect(hasLinkHideTransitions(ROOT, 0)).toBe(false)
  })

  it('scales the dash pattern with the line width', () => {
    expect(linkHideDashPattern(3)).toEqual([6, 6])
  })
})
