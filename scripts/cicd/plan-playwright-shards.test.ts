import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { assert, describe, expect, it, onTestFinished } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

import { reportTimings } from './load-playwright-timings'
import { planShards } from './plan-playwright-shards'

const tests = [
  { id: 'a1', file: 'a.spec.ts' },
  { id: 'a2', file: 'a.spec.ts' },
  { id: 'b', file: 'b.spec.ts' },
  { id: 'c', file: 'c.spec.ts' },
  { id: 'd', file: 'd.spec.ts' }
]

describe('whole-file duration sharding', () => {
  it('keeps every test when no historical timings are available', () => {
    expect(planShards(tests, {}, 2)).toEqual([
      {
        files: ['a.spec.ts', 'd.spec.ts'],
        testIds: ['a1', 'a2', 'd'],
        estimatedMs: 3
      },
      { files: ['b.spec.ts', 'c.spec.ts'], testIds: ['b', 'c'], estimatedMs: 2 }
    ])
  })

  it('balances time rather than test count without splitting or losing files', () => {
    expect(
      planShards(
        tests,
        { 'a.spec.ts': 9, 'b.spec.ts': 22, 'c.spec.ts': 7, 'd.spec.ts': 5 },
        2
      )
    ).toEqual([
      {
        files: ['b.spec.ts', 'd.spec.ts'],
        testIds: ['b', 'd'],
        estimatedMs: 27
      },
      {
        files: ['a.spec.ts', 'c.spec.ts'],
        testIds: ['a1', 'a2', 'c'],
        estimatedMs: 25
      }
    ])
  })

  it('estimates new files per collected test and does not select deleted baseline files', () => {
    expect(
      planShards(
        tests,
        { 'b.spec.ts': 12, 'c.spec.ts': 7, 'deleted.spec.ts': 5 },
        2
      )
    ).toEqual([
      {
        files: ['a.spec.ts', 'd.spec.ts'],
        testIds: ['a1', 'a2', 'd'],
        estimatedMs: 21
      },
      {
        files: ['b.spec.ts', 'c.spec.ts'],
        testIds: ['b', 'c'],
        estimatedMs: 19
      }
    ])
  })

  it('breaks duration ties by filename regardless of collection order', () => {
    const timings = {
      'a.spec.ts': 5,
      'b.spec.ts': 10,
      'c.spec.ts': 10,
      'd.spec.ts': 10
    }
    const plan = planShards(tests, timings, 2)
    expect(plan.map((shard) => shard.files)).toEqual([
      ['a.spec.ts', 'c.spec.ts'],
      ['b.spec.ts', 'd.spec.ts']
    ])
    expect(
      planShards([...tests].reverse(), timings, 2).map((shard) => shard.files)
    ).toEqual(plan.map((shard) => shard.files))
  })

  it.for([0, 1.5, 5])('rejects unusable shard count %s', (count) => {
    expect(() => planShards(tests, { 'a.spec.ts': 9 }, count)).toThrow()
  })

  it('rejects duplicate test identities rather than silently assigning them twice', () => {
    expect(() =>
      planShards([...tests, tests[0]], { 'a.spec.ts': 9 }, 2)
    ).toThrow()
  })

  it.for(['bad>file.spec.ts', 'bad\nfile.spec.ts', 'bad:12.spec.ts'])(
    'rejects a file that test-list cannot represent: %j',
    (file) => {
      expect(() =>
        planShards([{ id: 'test', file }], { known: 1 }, 1)
      ).toThrow()
    }
  )
})

it('uses project-specific first attempts from nested reports without counting retries or skips', () => {
  const report = {
    errors: [],
    stats: { unexpected: 0 },
    suites: [
      {
        suites: [
          {
            specs: [
              {
                file: 'a.spec.ts',
                tests: [
                  {
                    projectName: 'cloud',
                    results: [
                      { retry: 0, duration: 10, status: 'failed' },
                      { retry: 1, duration: 90, status: 'passed' }
                    ]
                  },
                  {
                    projectName: 'cloud',
                    results: [{ retry: 0, duration: 30, status: 'passed' }]
                  },
                  {
                    projectName: 'cloud',
                    results: [{ retry: 0, duration: 0, status: 'skipped' }]
                  },
                  {
                    projectName: 'chromium',
                    results: [{ retry: 0, duration: 500, status: 'passed' }]
                  }
                ]
              },
              {
                file: 'b.spec.ts',
                tests: [
                  {
                    projectName: 'cloud',
                    results: [{ retry: 0, duration: 7, status: 'passed' }]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
  expect(reportTimings(report, 'cloud')).toEqual({
    'a.spec.ts': 20,
    'b.spec.ts': 7
  })
})

it.for([
  { errors: ['incomplete report'], stats: { unexpected: 0 }, suites: [] },
  { errors: [], stats: { unexpected: 1 }, suites: [] }
])('rejects unsuccessful reports: %j', (report) => {
  expect(() => reportTimings(report, 'cloud')).toThrow()
})

function workflowSteps(root: string, project: 'cloud' | 'chromium') {
  const workflow = z
    .object({
      jobs: z.object({
        [`playwright-tests-${project}-sharded`]: z.object({
          steps: z.array(
            z.object({
              name: z.string().optional(),
              run: z.string().optional(),
              env: z
                .record(z.string(), z.union([z.string(), z.number()]))
                .optional()
            })
          )
        })
      })
    })
    .parse(
      parse(
        readFileSync(join(root, '.github/workflows/ci-tests-e2e.yaml'), 'utf8')
      )
    )
  const steps = workflow.jobs[`playwright-tests-${project}-sharded`].steps
  const plan = steps.find(
    (step) => step.name === `Plan ${project} shards by historical duration`
  )
  const run = steps.find((step) =>
    step.name?.startsWith('Run Playwright tests')
  )
  const runnable = z.object({
    run: z.string(),
    env: z.record(z.string(), z.union([z.string(), z.number()]))
  })
  return { plan: runnable.parse(plan), run: runnable.parse(run) }
}

function runWorkflowPilot(project: 'cloud' | 'chromium') {
  const root = resolve(import.meta.dirname, '../..')
  const directory = mkdtempSync(join(tmpdir(), `${project}-shards-`))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'))
  symlinkSync(join(root, 'scripts'), join(directory, 'scripts'))
  symlinkSync(join(root, 'tools'), join(directory, 'tools'))
  writeFileSync(join(directory, 'package.json'), '{"type":"module"}')
  writeFileSync(
    join(directory, 'playwright.config.ts'),
    `
import config from ${JSON.stringify(pathToFileURL(join(root, 'playwright.config.ts')).href)}
export default { ...config, testDir: './tests', globalSetup: undefined, globalTeardown: undefined, snapshotPathTemplate: '{testDir}/goldens/{arg}{ext}' }
`
  )
  mkdirSync(join(directory, 'tests/goldens'), { recursive: true })
  mkdirSync(join(directory, 'playwright-shard-timings'))
  writeFileSync(
    join(directory, 'playwright-shard-timings', `${project}.json`),
    JSON.stringify({ millisecondsPerTest: {} })
  )
  writeFileSync(join(directory, 'tests/goldens/stale.txt'), 'old')
  const specs = {
    a: `test.describe.configure({mode: 'serial'}); let state = 0; test('first @${project}', () => { state = 1 }); test('second @${project}', () => expect(state).toBe(1))`,
    b: `test('retry @${project}', ({}, info) => expect(info.retry).toBeGreaterThan(0))`,
    c: `test('snapshot @${project}', () => expect('new').toMatchSnapshot('stale.txt'))`,
    d: `test('pass @${project}', () => {}); test.skip('skip @${project}', () => {})`,
    e: `test.describe('default', () => { test.describe.configure({mode: 'default'}); let state = 0; test('first @${project}', () => { state = 1 }); test('second @${project}', () => expect(state).toBe(1)) })`
  }
  for (const [file, body] of Object.entries(specs)) {
    writeFileSync(
      join(directory, 'tests', `${file}.spec.ts`),
      `import { test, expect } from '@playwright/test'\n${body}\n`
    )
  }
  const { plan, run } = workflowSteps(root, project)
  const merged = join(directory, 'merged')
  mkdirSync(merged)
  const manifests: unknown[] = []
  for (const shard of [1, 2, 3, 4]) {
    const expand = (value: string) =>
      value
        .replaceAll('${{ matrix.shardIndex }}', String(shard))
        .replaceAll('${{ matrix.shardTotal }}', '4')
        .replaceAll('${{ runner.temp }}', directory)
    for (const step of shard === 1 ? [plan, run] : [run]) {
      const result = spawnSync('bash', ['-c', expand(step.run)], {
        cwd: directory,
        encoding: 'utf8',
        env: {
          ...process.env,
          CI: 'true',
          PATH: `${join(root, 'node_modules/.bin')}:${process.env.PATH}`,
          ...Object.fromEntries(
            Object.entries(step.env).map(([key, value]) => [
              key,
              expand(String(value))
            ])
          )
        }
      })
      assert.equal(
        result.status,
        step === plan
          ? 0
          : Number(
              readFileSync(
                join(directory, `${project}-shards`, `${shard}.txt`),
                'utf8'
              ).includes('snapshot @')
            ),
        result.stdout + result.stderr
      )
    }
    const name = `report-${project}-${shard}.zip`
    copyFileSync(join(directory, 'blob-report', name), join(merged, name))
    manifests.push(
      JSON.parse(
        readFileSync(join(directory, 'snapshot-updates/manifest.json'), 'utf8')
      )
    )
  }
  const blobs = readdirSync(merged)
  const lists = [1, 2, 3, 4].map((shard) =>
    readFileSync(join(directory, `${project}-shards`, `${shard}.txt`), 'utf8')
  )
  expect(lists.filter((list) => list.includes('d.spec.ts'))).toHaveLength(2)
  const result = spawnSync(
    join(root, 'node_modules/.bin/playwright'),
    ['merge-reports', '--reporter=html,json', merged],
    {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        PLAYWRIGHT_HTML_OPEN: 'never',
        PLAYWRIGHT_JSON_OUTPUT_NAME: join(
          directory,
          'playwright-report/report.json'
        )
      }
    }
  )
  assert.equal(result.status, 0, result.stdout + result.stderr)
  const report: unknown = JSON.parse(
    readFileSync(join(directory, 'playwright-report/report.json'), 'utf8')
  )
  return {
    blobs,
    report,
    manifests,
    html: readFileSync(join(directory, 'playwright-report/index.html'), 'utf8'),
    snapshot: readFileSync(
      join(directory, 'snapshot-updates/tests/goldens/stale.txt'),
      'utf8'
    )
  }
}

it.for(['cloud', 'chromium'] as const)(
  'runs the %s workflow lists with retries and merges unique blobs without losing snapshot updates',
  { timeout: 60_000 },
  (project) => {
    const result = runWorkflowPilot(project)
    expect(result.blobs).toEqual([
      `report-${project}-1.zip`,
      `report-${project}-2.zip`,
      `report-${project}-3.zip`,
      `report-${project}-4.zip`
    ])
    expect(result.report).toMatchObject({
      stats: { expected: 5, flaky: 1, unexpected: 1, skipped: 1 }
    })
    expect(result.manifests.flat()).toEqual(['tests/goldens/stale.txt'])
    expect(result.snapshot).toBe('new')
    expect(result.html).toContain('<html')
  }
)
