import { describe, expect, it } from 'vitest'

import {
  analyze,
  classify,
  elapsedMinutes,
  options
} from './analyze-pr-ci-runtime'

describe('CI runtime CLI options', () => {
  it.for([
    ['--cohort'],
    ['--commits'],
    ['--cache'],
    ['--output'],
    ['--cohort', '--refresh'],
    ['--cache', '--refresh']
  ])('rejects a missing operand in %j', (args) => {
    expect(() => options(args)).toThrow(`${args[0]} requires a value`)
  })

  it('uses supplied values and defaults only for absent options', () => {
    expect(
      options([
        '--cohort',
        '3',
        '--cache',
        'ci-cache',
        '--output',
        'report.json',
        '--refresh'
      ])
    ).toEqual({
      cohort: 3,
      commits: 5,
      cache: 'ci-cache',
      output: 'report.json',
      refresh: true
    })
  })
})

describe('CI runtime ownership', () => {
  it.for([
    ['CI: Tests Unit', 'test', 'unit'],
    ['CI: Tests E2E', 'setup', 'e2e-build'],
    ['CI: Tests E2E', 'playwright-tests (1, chromium)', 'e2e-test'],
    ['CI: Tests E2E', 'playwright-tests-chromium-sharded (1, 16)', 'e2e-test'],
    ['CI: Lint Format', 'repo-checks', 'repo-checks'],
    ['CI: Lint Format', 'lint-and-format', null],
    ['CI: Tests E2E', 'lint-pr / lint', 'lint'],
    ['CI: Tests E2E', 'lint-queue / typecheck', 'typecheck'],
    ['CI: Tests E2E', 'fallow / fallow', 'fallow'],
    ['CI: Tests E2E', 'unit / test', 'unit'],
    [
      'CI: Tests E2E',
      'ecosystem / ecosystem-matrix (vue, shard 2)',
      'custom-nodes'
    ],
    ['CI: Tests E2E', 'test', null],
    ['PR: Unified Report', 'test', null]
  ] satisfies [string, string, string | null][])(
    '%s / %s => %s',
    ([workflow, job, expected]) => {
      expect(classify(workflow, job)?.category ?? null).toBe(expected)
    }
  )
})

describe('cohort arithmetic', () => {
  it.for([
    ['success', '2026-01-01T00:00:00Z', '2026-01-01T00:04:00Z', 4],
    ['failure', '2026-01-01T00:00:00Z', '2026-01-01T00:02:00Z', 2],
    ['cancelled', '2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z', 1],
    ['skipped', null, null, null]
  ] satisfies [string, string | null, string | null, number | null][])(
    'measures %s jobs as %s minutes',
    ([conclusion, started_at, completed_at, expected]) => {
      expect(
        elapsedMinutes({
          id: 1,
          name: 'test',
          status: 'completed',
          conclusion,
          started_at,
          completed_at,
          html_url: 'u',
          labels: []
        })
      ).toBe(expected)
    }
  )

  it('counts real cancelled time, same-SHA gate waste, and missing source SHAs', () => {
    const base = {
      pr: 1,
      prUrl: 'u',
      committedAt: '2026-01-01',
      workflowId: 1,
      runAttempt: 1,
      runUrl: 'u',
      jobUrl: 'u',
      labels: [],
      runCompletedAt: '2026-01-01T00:10:00Z'
    }
    const samples = [
      {
        ...base,
        sha: 'a',
        workflow: 'CI: Lint Format',
        runId: 1,
        runCreatedAt: '2026-01-01T00:00:00Z',
        job: 'lint',
        category: 'lint' as const,
        gate: true,
        expensive: false,
        conclusion: 'failure',
        elapsedMinutes: 2
      },
      {
        ...base,
        sha: 'a',
        workflow: 'CI: Tests Unit',
        runId: 2,
        runCreatedAt: '2026-01-01T00:00:00Z',
        job: 'test',
        category: 'unit' as const,
        gate: false,
        expensive: true,
        conclusion: 'cancelled',
        elapsedMinutes: 7
      },
      {
        ...base,
        sha: 'b',
        workflow: 'CI: Tests Unit',
        runId: 3,
        runCreatedAt: '2026-01-01T00:00:00Z',
        job: 'test',
        category: 'unit' as const,
        gate: false,
        expensive: true,
        conclusion: 'success',
        elapsedMinutes: 3
      }
    ]
    const result = analyze(samples, [
      { pr: 1, sha: 'a' },
      { pr: 1, sha: 'b' },
      { pr: 2, sha: 'c' }
    ])
    expect(result.gateFailureImpact).toEqual({
      shas: 1,
      runnerMinutes: 7,
      jobs: 1
    })
    expect(result).toMatchObject({ sourceShas: 3, measuredShas: 2 })
    expect(
      result.workflows.find((x) => x.workflow === 'CI: Tests Unit')
    ).toMatchObject({ p50RunnerMinutes: 3, p90RunnerMinutes: 7 })
  })
})
