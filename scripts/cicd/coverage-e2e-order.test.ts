import { describe, expect, it } from 'vitest'

import type { CommitRelation, Compare } from './coverage-e2e-order'
import { orderE2eCoverage } from './coverage-e2e-order'

const HEAD = 'head-sha'

/** Answers every comparison with the same verdict. */
function always(relation: CommitRelation): Compare {
  return () => Promise.resolve(relation)
}

/** Keyed `base->head`, so one fake can answer the two different questions. */
function relating(verdicts: Record<string, CommitRelation>): Compare {
  return (base, head) =>
    Promise.resolve(verdicts[`${base}->${head}`] ?? 'ahead')
}

describe('orderE2eCoverage', () => {
  it('reports coverage measured at an ancestor of this commit', async () => {
    const order = await orderE2eCoverage(
      { current: 'ancestor', baseline: null },
      HEAD,
      always('ahead')
    )

    expect(order).toEqual({ usable: true, withheld: [] })
  })

  // Nothing to ask GitHub, so this must hold without any comparison at all.
  it('reports coverage measured at this exact commit', async () => {
    const order = await orderE2eCoverage(
      { current: HEAD, baseline: null },
      HEAD,
      () => Promise.reject(new Error('no comparison should be needed'))
    )

    expect(order).toEqual({ usable: true, withheld: [] })
  })

  // Each row is coverage this commit cannot be credited with: publishing it
  // under this PR's headline would attribute a descendant's movement to it.
  it.for<[relation: CommitRelation, description: string]>([
    ['behind', 'measured on a descendant'],
    ['diverged', 'measured on a commit off this line'],
    ['unknown', 'left unordered by a failed comparison']
  ])('withholds coverage %s (%s)', async ([relation]) => {
    const order = await orderE2eCoverage(
      { current: 'elsewhere', baseline: 'older' },
      HEAD,
      always(relation)
    )

    expect(order.usable).toBe(false)
    expect(order.withheld).toEqual([
      {
        target: 'current',
        reason:
          'E2E coverage was measured on elsewhere, which this commit does not contain'
      }
    ])
  })

  it('withholds a baseline the new measurement is not ahead of', async () => {
    const order = await orderE2eCoverage(
      { current: 'measured', baseline: 'newer' },
      HEAD,
      relating({ 'measured->head-sha': 'ahead', 'newer->measured': 'behind' })
    )

    expect(order.usable).toBe(false)
    expect(order.withheld).toEqual([
      {
        target: 'baseline',
        reason: 'E2E baseline newer is not behind measured'
      }
    ])
  })

  // An identified baseline must not be replaced by a measurement that cannot
  // be placed against it.
  it('withholds an identified baseline when the measurement names no commit', async () => {
    const order = await orderE2eCoverage(
      { current: null, baseline: 'identified' },
      HEAD,
      always('ahead')
    )

    expect(order.usable).toBe(false)
    expect(order.withheld).toEqual([
      {
        target: 'baseline',
        reason:
          'E2E coverage names no commit to order against baseline identified'
      }
    ])
  })

  // A baseline stored before sidecars existed must stay replaceable, or it
  // would block its own succession forever.
  it('replaces a baseline that names no commit', async () => {
    const order = await orderE2eCoverage(
      { current: null, baseline: null },
      HEAD,
      always('ahead')
    )

    expect(order).toEqual({ usable: true, withheld: [] })
  })
})
