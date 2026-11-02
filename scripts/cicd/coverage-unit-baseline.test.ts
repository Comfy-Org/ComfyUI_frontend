import { describe, expect, it } from 'vitest'

import type { History, WorkflowRun } from './coverage-unit-baseline'
import {
  MAX_HOPS,
  liveArtifactNamesOf,
  resolveUnitBaseline
} from './coverage-unit-baseline'

const UNIT_COVERAGE = 'unit-coverage'

interface RunFixture extends WorkflowRun {
  artifacts: string[]
}

type CommitFixture = [sha: string, parent: string | null, runs: RunFixture[]]

const NONE: RunFixture[] = []
const MEASURED: RunFixture[] = [
  { id: 71, conclusion: 'success', artifacts: [UNIT_COVERAGE] }
]

function history(...commits: CommitFixture[]): History {
  const parents = new Map(commits.map(([sha, parent]) => [sha, parent]))
  const runs = new Map(commits.map(([sha, , shaRuns]) => [sha, shaRuns]))
  const artifacts = new Map(
    commits.flatMap(([, , shaRuns]) =>
      shaRuns.map((run): [number, string[]] => [run.id, run.artifacts])
    )
  )

  return {
    firstParentOf: (sha) => Promise.resolve(parents.get(sha) ?? null),
    unitRunsFor: (sha) =>
      Promise.resolve(
        (runs.get(sha) ?? []).map(({ id, conclusion }) => ({ id, conclusion }))
      ),
    liveArtifactsOf: (runId) => Promise.resolve(artifacts.get(runId) ?? [])
  }
}

/** `head` → `gap-1` → … → `gap-n` → `oldest`, measured only at `oldest`. */
function historyWithGaps(gaps: number): History {
  const shas = ['head', ...Array.from({ length: gaps }, (_, i) => `gap-${i}`)]
  return history(
    ...shas.map(
      (sha, index): CommitFixture => [sha, shas[index + 1] ?? 'oldest', NONE]
    ),
    ['oldest', null, MEASURED]
  )
}

describe('resolveUnitBaseline', () => {
  it('measures against the direct parent when its run kept coverage', async () => {
    const baseline = await resolveUnitBaseline(
      history(['head', 'parent', NONE], ['parent', null, MEASURED]),
      'head'
    )

    expect(baseline).toEqual({
      ancestor: 'parent',
      runId: 71,
      spanned: false
    })
  })

  // Every row is a parent whose coverage cannot be trusted or does not exist,
  // which is the whole reason the walk is not pinned to the direct parent.
  it.for<[reason: string, runs: RunFixture[]]>([
    [
      'was cancelled after its always() upload ran',
      [{ id: 9, conclusion: 'cancelled', artifacts: [UNIT_COVERAGE] }]
    ],
    [
      'is still in flight',
      [{ id: 9, conclusion: null, artifacts: [UNIT_COVERAGE] }]
    ],
    [
      'reached a verdict but holds no live coverage',
      [{ id: 9, conclusion: 'failure', artifacts: [] }]
    ],
    ['never ran, because a merge-queue batch landed it', NONE]
  ])('reaches past a parent whose run %s', async ([, runs]) => {
    const baseline = await resolveUnitBaseline(
      history(
        ['head', 'parent', NONE],
        ['parent', 'grandparent', runs],
        ['grandparent', null, MEASURED]
      ),
      'head'
    )

    expect(baseline).toEqual({
      ancestor: 'grandparent',
      runId: 71,
      spanned: true
    })
  })

  // A release-branch push of the same commit produces a second, newer run on a
  // ref that still cancels, and that run may have died partway through merging
  // the shard reports.
  it('prefers an older run that reached a verdict to a newer cancelled one', async () => {
    const baseline = await resolveUnitBaseline(
      history(
        ['head', 'parent', NONE],
        [
          'parent',
          null,
          [
            { id: 9, conclusion: 'cancelled', artifacts: [UNIT_COVERAGE] },
            { id: 8, conclusion: 'success', artifacts: [UNIT_COVERAGE] }
          ]
        ]
      ),
      'head'
    )

    expect(baseline.runId).toBe(8)
  })

  it('reports nothing to compare against at a root commit', async () => {
    const baseline = await resolveUnitBaseline(
      history(['head', null, NONE]),
      'head'
    )

    expect(baseline).toEqual({
      ancestor: null,
      runId: null,
      spanned: false,
      lastChecked: null
    })
  })

  it(`still finds a baseline ${MAX_HOPS} commits back`, async () => {
    const baseline = await resolveUnitBaseline(
      historyWithGaps(MAX_HOPS - 1),
      'head'
    )

    expect(baseline).toEqual({ ancestor: 'oldest', runId: 71, spanned: true })
  })

  // Naming the last candidate is what lets a reader tell whether the walk ran
  // out of budget or ran out of history, and so whether a re-run would help.
  it(`gives up past ${MAX_HOPS} commits, naming how far it got`, async () => {
    const baseline = await resolveUnitBaseline(
      historyWithGaps(MAX_HOPS),
      'head'
    )

    expect(baseline).toEqual({
      ancestor: null,
      runId: null,
      spanned: false,
      lastChecked: `gap-${MAX_HOPS - 1}`
    })
  })
})

// The listing endpoint returns expired artifacts too. Selecting a run on the
// strength of one leaves the ancestor download empty, and unit silently drops
// out of that report.
describe('liveArtifactNamesOf', () => {
  it.for<[label: string, expired: boolean, expected: string[]]>([
    ['keeps a live artifact', false, [UNIT_COVERAGE]],
    ['drops an expired artifact', true, []]
  ])('%s', ([, expired, expected]) => {
    expect(
      liveArtifactNamesOf({
        artifacts: [{ name: UNIT_COVERAGE, expired }]
      })
    ).toEqual(expected)
  })

  it.for<[shape: string, page: unknown]>([
    ['a page that is not an object', 'nope'],
    ['a page with no artifacts key', {}],
    ['artifacts that are not a list', { artifacts: 'nope' }],
    ['an entry with no name', { artifacts: [{ expired: false }] }]
  ])('reads no names from %s', ([, page]) => {
    expect(liveArtifactNamesOf(page)).toEqual([])
  })
})
