import { describe, expect, it } from 'vitest'

import type { Rect } from '@/lib/litegraph/src/interfaces'
import {
  couldLinkBeVisible,
  overlapBounding
} from '@/lib/litegraph/src/measure'

const SCREEN: Rect = [0, 0, 1000, 800]

describe('couldLinkBeVisible', () => {
  it('keeps a link whose endpoints straddle the screen', () => {
    // The case that makes endpoint-only culling wrong: neither node is on
    // screen, but the link between them crosses it.
    const left: Rect = [-5000, 400, 200, 100]
    const right: Rect = [5000, 400, 200, 100]

    expect(couldLinkBeVisible(left, right, SCREEN)).toBe(true)
  })

  it('keeps a link between two nodes that vertically straddle the screen', () => {
    const above: Rect = [500, -4000, 200, 100]
    const below: Rect = [500, 4000, 200, 100]

    expect(couldLinkBeVisible(above, below, SCREEN)).toBe(true)
  })

  it('rejects a link with both nodes off the same side', () => {
    const farLeft: Rect = [-5000, 400, 200, 100]
    const alsoFarLeft: Rect = [-4000, 400, 200, 100]

    expect(couldLinkBeVisible(farLeft, alsoFarLeft, SCREEN)).toBe(false)
  })

  it('keeps a link when only one node is on screen', () => {
    const onScreen: Rect = [400, 300, 200, 100]
    const offScreen: Rect = [-5000, 300, 200, 100]

    expect(couldLinkBeVisible(onScreen, offScreen, SCREEN)).toBe(true)
  })

  it('keeps a node pair touching the screen edge, matching overlapBounding', () => {
    // overlapBounding treats edge contact as overlap, so this must too or the
    // two tests disagree at the boundary.
    const touching: Rect = [-200, 300, 200, 100]

    expect(couldLinkBeVisible(touching, touching, SCREEN)).toBe(true)
  })
})

/**
 * The property the optimisation rests on. `drawConnections` culls against the
 * box spanning the two slot positions; this test must never exclude a link that
 * box would have kept, or links vanish from the canvas.
 */
describe('couldLinkBeVisible never hides a link the exact test would draw', () => {
  // Deterministic LCG - a flake here is a rendering bug, so the failing case
  // has to be reproducible.
  function makeRandom(seed: number): () => number {
    let state = seed
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      return state / 0x1_0000_0000
    }
  }

  it('holds across randomised node placements', () => {
    const random = makeRandom(20260814)
    const spread = (): number => (random() - 0.5) * 6000
    const nodeRect = (): Rect => [
      spread(),
      spread(),
      40 + random() * 400,
      30 + random() * 300
    ]

    for (let i = 0; i < 20_000; i++) {
      const start = nodeRect()
      const end = nodeRect()

      // Slot positions lie somewhere within their node's bounding rect.
      const startX = start[0] + random() * start[2]
      const startY = start[1] + random() * start[3]
      const endX = end[0] + random() * end[2]
      const endY = end[1] + random() * end[3]

      const exact: Rect = [
        Math.min(startX, endX),
        Math.min(startY, endY),
        Math.abs(endX - startX),
        Math.abs(endY - startY)
      ]

      if (!overlapBounding(exact, SCREEN)) continue

      expect(
        couldLinkBeVisible(start, end, SCREEN),
        `hid a visible link: start=${JSON.stringify(start)} end=${JSON.stringify(end)}`
      ).toBe(true)
    }
  })
})
