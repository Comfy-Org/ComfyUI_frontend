import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { CommitRelation, Compare } from './coverage-e2e-order'
import { orderE2eCoverage } from './coverage-e2e-order'

const HEAD = 'head-sha'
const SCRIPT = join(import.meta.dirname, 'coverage-e2e-order.ts')
const TSX = join(import.meta.dirname, '../../node_modules/.bin/tsx')
const CURRENT = 'temp/e2e-coverage'
const BASELINE = 'temp/e2e-coverage-baseline'

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
    ['diverged', 'measured on a commit off this line']
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

  // A failed comparison establishes nothing about ancestry. Reporting it as
  // one sends whoever reads the warning through the history for an API fault.
  it('says a comparison failed rather than blaming the history', async () => {
    const order = await orderE2eCoverage(
      { current: 'elsewhere', baseline: null },
      HEAD,
      always('unknown')
    )

    expect(order.usable).toBe(false)
    expect(order.withheld).toEqual([
      {
        target: 'current',
        reason:
          'E2E coverage at elsewhere could not be ordered against this commit'
      }
    ])
  })

  it('says so for a baseline it could not order either', async () => {
    const order = await orderE2eCoverage(
      { current: 'measured', baseline: 'older' },
      HEAD,
      relating({ 'measured->head-sha': 'ahead', 'older->measured': 'unknown' })
    )

    expect(order.withheld).toEqual([
      {
        target: 'baseline',
        reason: 'E2E baseline older could not be ordered against measured'
      }
    ])
  })

  // The steady state between E2E runs: the same artifact is read again, the
  // delta is zero, and re-saving it leaves the baseline where it was.
  it('keeps a baseline the measurement has not moved past', async () => {
    const order = await orderE2eCoverage(
      { current: 'measured', baseline: 'measured' },
      HEAD,
      relating({ 'measured->head-sha': 'ahead' })
    )

    expect(order).toEqual({ usable: true, withheld: [] })
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

// Which directory a withheld target maps to is decided in the shim, not in
// the function above, so a transposed pair would leave every case here green
// while the report named the wrong numbers. Neither case reaches the network:
// with no token the comparison fails, which is itself one of the verdicts.
describe('coverage-e2e-order.ts', () => {
  function orderingFixture() {
    const root = mkdtempSync(join(tmpdir(), 'e2e-order-'))

    return {
      writeSidecar(directory: string, sourceSha: string) {
        mkdirSync(join(root, directory), { recursive: true })
        writeFileSync(
          join(root, directory, 'coverage-metadata.json'),
          JSON.stringify({ complete: true, sourceSha })
        )
      },
      run() {
        const output = join(root, 'github-output')
        const result = spawnSync(TSX, [SCRIPT], {
          cwd: root,
          encoding: 'utf8',
          env: {
            ...process.env,
            GH_TOKEN: '',
            GITHUB_TOKEN: '',
            GITHUB_REPOSITORY: 'o/r',
            HEAD_SHA: HEAD,
            GITHUB_OUTPUT: output
          }
        })
        return {
          status: result.status,
          output: `${result.stdout}${result.stderr}`,
          kept: (directory: string) => existsSync(join(root, directory))
        }
      },
      [Symbol.dispose]() {
        rmSync(root, { recursive: true, force: true })
      }
    }
  }

  it('removes the measurement it withheld, not the baseline', () => {
    using fixture = orderingFixture()
    fixture.writeSidecar(CURRENT, 'elsewhere')
    fixture.writeSidecar(BASELINE, 'older')

    const result = fixture.run()

    expect(result.status).toBe(0)
    expect(result.kept(CURRENT)).toBe(false)
    expect(result.kept(BASELINE)).toBe(true)
    expect(result.output).toContain(`withholding ${CURRENT}`)
  })

  it('removes the baseline it withheld, not the measurement', () => {
    using fixture = orderingFixture()
    fixture.writeSidecar(BASELINE, 'identified')

    const result = fixture.run()

    expect(result.status).toBe(0)
    expect(result.kept(BASELINE)).toBe(false)
    expect(result.output).toContain(`withholding ${BASELINE}`)
  })
})
