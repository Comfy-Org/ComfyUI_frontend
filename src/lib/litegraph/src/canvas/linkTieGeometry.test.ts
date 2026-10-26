import { describe, expect, it } from 'vitest'

import type { Point } from '@/lib/litegraph/src/interfaces'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import type { Point as LayoutPoint } from '@/renderer/core/layout/types'
import { toLinkId } from '@/types/linkId'
import type { LinkId } from '@/types/linkId'
import type { LinkTie } from '@/types/linkTie'
import { toLinkTieId } from '@/types/linkTieId'

import {
  findLinkTieAt,
  routeThroughTies,
  strokeHits,
  tieFromStroke,
  tieRouteExtent,
  tiesCrossedByStroke
} from './linkTieGeometry'

const SPACING = 4
const A = toLinkId(1)
const B = toLinkId(2)
const C = toLinkId(3)

function tie(id: number, pos: Point, linkIds: LinkId[], angle = 0): LinkTie {
  return { id: toLinkTieId(id), pos, angle, linkIds }
}

function horizontal(y: number, from = 0, to = 200): LayoutPoint[] {
  return [
    { x: from, y },
    { x: to, y }
  ]
}

function route(ties: LinkTie[], linkId: LinkId) {
  return routeThroughTies(
    ties,
    linkId,
    [0, 0],
    [300, 0],
    LinkDirection.RIGHT,
    LinkDirection.LEFT,
    SPACING
  )
}

describe('routeThroughTies', () => {
  it('leaves an untied link as one segment with its slot directions', () => {
    expect(route([tie(1, [100, 0], [B])], A)).toEqual([
      {
        a: [0, 0],
        b: [300, 0],
        startDir: LinkDirection.RIGHT,
        endDir: LinkDirection.LEFT,
        startControl: undefined,
        endControl: undefined
      }
    ])
  })

  it.for([
    { linkId: A, offset: -SPACING },
    { linkId: B, offset: 0 },
    { linkId: C, offset: SPACING }
  ])(
    'passes strand $linkId through the tie offset by $offset across it',
    ({ linkId, offset }) => {
      const [toTie, fromTie] = route([tie(1, [100, 50], [A, B, C])], linkId)

      expect(toTie.b).toEqual([100, 50 + offset])
      expect(fromTie.a).toEqual([100, 50 + offset])
      expect(toTie.endDir).toBe(LinkDirection.CENTER)
      expect(fromTie.startDir).toBe(LinkDirection.CENTER)
    }
  )

  it('runs a strand along the tie direction on both sides', () => {
    const [toTie, fromTie] = route([tie(1, [100, 0], [A], Math.PI / 2)], A)

    expect(toTie.endControl?.[0]).toBeCloseTo(0)
    expect(toTie.endControl?.[1]).toBeLessThan(0)
    expect(fromTie.startControl?.[0]).toBeCloseTo(0)
    expect(fromTie.startControl?.[1]).toBeGreaterThan(0)
  })

  it('visits ties in order from output to input, whatever their storage order', () => {
    const segments = route([tie(1, [200, 0], [A]), tie(2, [100, 0], [A])], A)

    expect(segments.map((segment) => segment.a)).toEqual([
      [0, 0],
      [100, 0],
      [200, 0]
    ])
  })
})

describe('tieRouteExtent', () => {
  it('reaches a tie far outside the box of the link endpoints', () => {
    const extent = tieRouteExtent(route([tie(1, [150, 900], [A])], A))

    expect(Math.max(...extent.map(([, y]) => y))).toBeGreaterThanOrEqual(900)
  })
})

describe('strokeHits and tieFromStroke', () => {
  const polylines = [
    [A, horizontal(0)],
    [B, horizontal(20)],
    [C, horizontal(40, 150, 300)]
  ] as const

  it('hits only the links the stroke crosses', () => {
    const hits = strokeHits(polylines, [100, -10], [100, 30])

    expect(hits.map((hit) => hit.linkId)).toEqual([A, B])
  })

  it('centres a new tie on the crossings, aligned with the links, strands ordered across it', () => {
    const hits = strokeHits(polylines, [100, 30], [100, -10])

    const draft = tieFromStroke(hits, [100, 30], [100, -10], [])

    expect(draft.pos[0]).toBeCloseTo(100)
    expect(draft.pos[1]).toBeCloseTo(10)
    expect(draft.angle).toBeCloseTo(0)
    expect(draft.linkIds).toEqual([A, B])
  })

  it('inherits strand order from a tie that already holds every crossed link', () => {
    const hits = strokeHits(polylines, [100, -10], [100, 30])

    const draft = tieFromStroke(
      hits,
      [100, -10],
      [100, 30],
      [tie(1, [50, 10], [B, A])]
    )

    expect(draft.linkIds).toEqual([B, A])
  })
})

describe('tie hit testing', () => {
  const ties = [tie(1, [100, 10], [A, B, C]), tie(2, [100, 10], [A])]

  it('finds the topmost tie under the point', () => {
    expect(findLinkTieAt(ties, [101, 10], SPACING, 0)?.id).toBe(2)
  })

  it('reaches the full strap of a wide tie', () => {
    expect(findLinkTieAt([ties[0]], [100, 16], SPACING, 0)?.id).toBe(1)
    expect(findLinkTieAt([ties[0]], [100, 20], SPACING, 0)).toBeUndefined()
  })

  it('reports ties whose strap a stroke crosses', () => {
    const crossed = tiesCrossedByStroke(ties, [80, 10], [120, 10], SPACING)
    const missed = tiesCrossedByStroke(ties, [80, 40], [120, 40], SPACING)

    expect(crossed.map((crossedTie) => crossedTie.id)).toEqual([1, 2])
    expect(missed).toEqual([])
  })
})
