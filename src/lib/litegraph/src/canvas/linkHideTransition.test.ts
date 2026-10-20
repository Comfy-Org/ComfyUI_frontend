import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { toRootGraphId } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'

import {
  LINK_HIDE_TRANSITION,
  cancelLinkHideTransition,
  hasLinkHideTransitions,
  linkHideLabelScale,
  linkHideSnap,
  springEase,
  startLinkHideTransitions
} from './linkHideTransition'

const ROOT = toRootGraphId('root')
const LINK_A = toLinkId(1)
const LINK_B = toLinkId(2)
const { snapMs, labelPopMs, labelPopFromScale } = LINK_HIDE_TRANSITION

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
})

describe('springEase', () => {
  it('starts at rest, recoils once by under ten percent, and settles', () => {
    const samples = Array.from({ length: 101 }, (_, i) => springEase(i / 100))

    expect(samples[0]).toBe(0)
    expect(Math.max(...samples)).toBeGreaterThan(1)
    expect(Math.max(...samples)).toBeLessThan(1.1)
    expect(samples[100]).toBeCloseTo(1, 1)
  })
})

describe('linkHideTransition', () => {
  it('snaps the link back, then expires', () => {
    startLinkHideTransitions(ROOT, [LINK_A], 0)

    expect(linkHideSnap(ROOT, LINK_A, 0)).toBe(0)
    expect(linkHideSnap(ROOT, LINK_A, snapMs / 2)).toBeGreaterThan(0.9)
    expect(hasLinkHideTransitions(ROOT, snapMs - 1)).toBe(true)
    expect(linkHideSnap(ROOT, LINK_A, snapMs)).toBeUndefined()
    expect(hasLinkHideTransitions(ROOT, snapMs)).toBe(false)
  })

  it('pops the labels in alongside the snap', () => {
    startLinkHideTransitions(ROOT, [LINK_A], 0)

    expect(linkHideLabelScale(ROOT, LINK_A, 0)).toBeCloseTo(labelPopFromScale)
    expect(linkHideLabelScale(ROOT, LINK_A, labelPopMs / 2)).toBeGreaterThan(1)
    expect(linkHideLabelScale(ROOT, LINK_A, labelPopMs)).toBe(1)
  })

  it('animates a batch together', () => {
    startLinkHideTransitions(ROOT, [LINK_A, LINK_B], 0)

    expect(linkHideSnap(ROOT, LINK_A, 50)).toBe(linkHideSnap(ROOT, LINK_B, 50))
  })

  it('cancels one link without touching the rest of its batch', () => {
    startLinkHideTransitions(ROOT, [LINK_A, LINK_B], 0)

    expect(cancelLinkHideTransition(ROOT, LINK_A)).toBe(true)
    expect(linkHideSnap(ROOT, LINK_A, 10)).toBeUndefined()
    expect(linkHideSnap(ROOT, LINK_B, 10)).toBeDefined()
    expect(cancelLinkHideTransition(ROOT, LINK_A)).toBe(false)
  })

  it('skips the transition under reduced motion', () => {
    stubReducedMotion(true)

    startLinkHideTransitions(ROOT, [LINK_A], 0)

    expect(linkHideSnap(ROOT, LINK_A, 0)).toBeUndefined()
    expect(hasLinkHideTransitions(ROOT, 0)).toBe(false)
  })
})
