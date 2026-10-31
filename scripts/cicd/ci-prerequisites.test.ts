import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const workflowSchema = z.object({
  on: z.record(z.string(), z.unknown()),
  jobs: z.record(
    z.string(),
    z.object({
      needs: z.union([z.string(), z.array(z.string())]).optional(),
      if: z.string().optional(),
      uses: z.string().optional(),
      strategy: z.object({ matrix: z.unknown() }).optional(),
      steps: z
        .array(
          z.object({
            run: z.string().optional(),
            uses: z.string().optional(),
            with: z.record(z.string(), z.unknown()).optional()
          })
        )
        .optional()
    })
  )
})

function workflow(file: string) {
  return workflowSchema.parse(
    parse(readFileSync(`.github/workflows/${file}`, 'utf8'))
  )
}

const pipeline = workflow('ci-tests-e2e.yaml')

it.for([
  ['ci-tests-e2e.yaml', 'merge-reports'],
  ['ci-playwright-videos.yaml', 'report']
])('%s report merging uses the repository pnpm version', ([file, job]) => {
  const steps = workflow(file).jobs[job].steps ?? []
  const installIndex = steps.findIndex((step) =>
    step.uses?.startsWith('pnpm/action-setup@')
  )
  expect(installIndex).toBeGreaterThan(0)
  expect(steps[installIndex].with ?? {}).not.toHaveProperty('version')
  expect(steps.slice(0, installIndex)).toContainEqual(
    expect.objectContaining({
      uses: expect.stringMatching(/^actions\/checkout@/),
      with: expect.objectContaining({
        'sparse-checkout': '/package.json',
        'sparse-checkout-cone-mode': false
      })
    })
  )
})

function verdict(job: string, env: Record<string, string>) {
  const script = pipeline.jobs[job].steps?.[0].run
  if (!script) throw new Error(`Missing verdict script for ${job}`)
  return spawnSync(
    'bash',
    ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script],
    {
      env: { PATH: process.env.PATH, ...env },
      encoding: 'utf8'
    }
  ).status
}

describe('candidate prerequisites', () => {
  it.for([
    ['PR succeeds', {}, 0],
    ['merge queue succeeds', { EVENT: 'merge_group' }, 0],
    ['lint fails', { LINT: 'failure' }, 1],
    ['fallow fails', { FALLOW: 'failure' }, 1],
    ['build fails', { BUILD: 'failure' }, 1],
    ['change detection fails', { CHANGES: 'failure' }, 1],
    ['lint is cancelled', { LINT: 'cancelled' }, 1],
    ['fallow is skipped', { FALLOW: 'skipped' }, 1],
    ['required build is skipped', { BUILD: 'skipped' }, 1],
    [
      'irrelevant build is skipped',
      { SHOULD_BUILD: 'false', BUILD: 'skipped' },
      0
    ],
    ['build selection is missing', { SHOULD_BUILD: '', BUILD: 'skipped' }, 1],
    [
      'push keeps its independent lint workflow',
      { EVENT: 'push', LINT: 'skipped', FALLOW: 'skipped' },
      0
    ],
    [
      'manual E2E remains standalone',
      { EVENT: 'workflow_dispatch', LINT: 'skipped', FALLOW: 'skipped' },
      0
    ]
  ] satisfies [string, Record<string, string>, number][])(
    '%s',
    ([_name, overrides, expected]) => {
      expect(
        verdict('preflight', {
          EVENT: 'pull_request',
          CHANGES: 'success',
          SHOULD_BUILD: 'true',
          BUILD: 'success',
          LINT: 'success',
          FALLOW: 'success',
          ...overrides
        })
      ).toBe(expected)
    }
  )

  it.for([
    ['test', { PREFLIGHT: 'skipped', UNIT: 'skipped' }, 1],
    ['test', { PREFLIGHT: 'success', UNIT: 'success' }, 0],
    [
      'e2e-status',
      {
        PREFLIGHT: 'skipped',
        CHANGES: 'success',
        SHOULD_RUN: 'false',
        SHARDED: 'skipped',
        BROWSERS: 'skipped',
        VIDEO: 'skipped'
      },
      1
    ],
    [
      'e2e-status',
      {
        PREFLIGHT: 'success',
        CHANGES: 'success',
        SHOULD_RUN: 'false',
        SHARDED: 'skipped',
        BROWSERS: 'skipped',
        VIDEO: 'skipped'
      },
      0
    ]
  ] satisfies [string, Record<string, string>, number][])(
    '%s reports blocked versus intentionally skipped tests: %j',
    ([job, env, expected]) => {
      expect(verdict(job, env)).toBe(expected)
    }
  )

  it.for([
    ['CLOUD', 'success', 0],
    ['CLOUD', 'failure', 1],
    ['CLOUD', 'cancelled', 1],
    ['CLOUD', 'skipped', 1]
  ] satisfies [string, string, number][])(
    '%s ending with %s produces E2E exit status %s',
    ([job, status, expected]) => {
      expect(
        verdict('e2e-status', {
          PREFLIGHT: 'success',
          CHANGES: 'success',
          SHOULD_RUN: 'true',
          SHARDED: 'success',
          CLOUD: 'success',
          BROWSERS: 'success',
          VIDEO: 'skipped',
          [job]: status
        })
      ).toBe(expected)
    }
  )

  it.for([
    ['a skipped chromium suite', 'false', {}, 1],
    ['a skipped chromium suite', 'true', {}, 0],
    ['a failing chromium suite', 'true', { SHARDED: 'failure' }, 1],
    ['a failing cloud suite', 'true', { CLOUD: 'failure' }, 1],
    ['a cancelled cloud suite', 'true', { CLOUD: 'cancelled' }, 1],
    ['a skipped cloud suite', 'true', { CLOUD: 'skipped' }, 1],
    ['a skipped browser matrix', 'true', { BROWSERS: 'skipped' }, 1]
  ] satisfies [string, string, Record<string, string>, number][])(
    'E2E status with %s (release push %s, %j) exits %s',
    ([_name, releasePush, overrides, expected]) => {
      expect(
        verdict('e2e-status', {
          PREFLIGHT: 'success',
          CHANGES: 'success',
          SHOULD_RUN: 'true',
          RELEASE_PUSH: releasePush,
          SHARDED: 'skipped',
          CLOUD: 'success',
          BROWSERS: 'success',
          ...overrides
        })
      ).toBe(expected)
    }
  )

  it.for([
    ['playwright-tests-chromium-sharded', true],
    ['upload-e2e-coverage', true],
    ['playwright-tests', false],
    ['playwright-tests-cloud-sharded', false],
    ['merge-reports', false],
    ['setup', false]
  ] satisfies [string, boolean][])(
    '%s is skipped on release pushes: %s',
    ([job, skipped]) => {
      const condition = pipeline.jobs[job].if ?? ''
      expect(
        condition.includes("needs.changes.outputs.is-release-push != 'true'")
      ).toBe(skipped)
      expect(condition.includes('is-release-push')).toBe(skipped)
    }
  )

  it.for([
    ['playwright-tests', 'browser', ['mobile-safari']],
    ['merge-reports', 'project', ['cloud']]
  ] satisfies [string, string, string[]][])(
    '%s keeps only its cloud %s entries on release pushes',
    ([job, key, cloudEntries]) => {
      const matrix = z
        .record(z.string(), z.unknown())
        .parse(pipeline.jobs[job].strategy?.matrix)
      const entries = z.array(z.string()).parse(matrix[key])
      const exclude = z
        .string()
        .regex(
          /^\$\{\{ fromJSON\(needs\.changes\.outputs\.is-release-push == 'true' && '(.*)' \|\| '\[\]'\) \}\}$/
        )
        .parse(matrix.exclude)
        .match(/&& '(.*)' \|\|/)?.[1]
      const excluded = z
        .array(z.record(z.string(), z.string()))
        .parse(JSON.parse(exclude ?? 'null'))
        .map((entry) => entry[key])
      expect(entries.filter((entry) => !excluded.includes(entry))).toEqual(
        cloudEntries
      )
    }
  )

  it.for(['e2e-status', 'deploy-and-comment'])(
    '%s does not wait for videos',
    (job) => {
      expect([pipeline.jobs[job].needs].flat()).not.toContain(
        'playwright-video-new-tests'
      )
    }
  )

  it.for([
    'unit',
    'ecosystem',
    'playwright-tests-chromium-sharded',
    'playwright-tests-cloud-sharded',
    'playwright-tests',
    'comment-on-pr-start'
  ])('%s overrides skipped ancestors only after preflight succeeds', (job) => {
    expect([pipeline.jobs[job].needs].flat()).toContain('preflight')
    expect(pipeline.jobs[job].if).toMatch(
      /^\$\{\{\s*!cancelled\(\)\s*&&\s*needs\.preflight\.result == 'success'\s*&&/
    )
  })

  it.for(['lint-pr', 'lint-queue', 'fallow', 'unit', 'ecosystem'])(
    '%s is called in the same run without a duplicate candidate trigger',
    (job) => {
      const file = pipeline.jobs[job].uses
      expect(file).toBeDefined()
      const called = workflow((file ?? '').replace('./.github/workflows/', ''))
      expect(Object.keys(called.on)).toContain('workflow_call')
      expect(Object.keys(called.on)).not.toContain('pull_request')
      expect(Object.keys(called.on)).not.toContain('merge_group')
    }
  )
})
