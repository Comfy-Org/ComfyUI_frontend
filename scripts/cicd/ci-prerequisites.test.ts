import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
      steps: z
        .array(
          z.object({
            id: z.string().optional(),
            run: z.string().optional(),
            uses: z.string().optional(),
            with: z.record(z.string(), z.unknown()).optional(),
            env: z.record(z.string(), z.string()).optional()
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
        'sparse-checkout': expect.stringMatching(/^\/package\.json$/m),
        'sparse-checkout-cone-mode': false
      })
    })
  )
})

function lockfileWithPlaywright(catalogVersion: string, rootVersion: string) {
  return [
    'catalogs:',
    '  default:',
    "    '@playwright/test':",
    '      specifier: ^1.0.0',
    `      version: ${catalogVersion}`,
    'importers:',
    '  .:',
    '    devDependencies:',
    "      '@playwright/test':",
    '        specifier: ^1.0.0',
    `        version: ${rootVersion}`,
    '  apps/website:',
    '    devDependencies:',
    "      '@playwright/test':",
    '        specifier: ^1.0.0',
    '        version: 9.9.9',
    'packages:',
    ''
  ].join('\n')
}

function readLockedPlaywrightVersion(lockfile: string) {
  const step = pipeline.jobs['merge-reports'].steps?.find(
    (candidate) => candidate.id === 'playwright-version'
  )
  if (!step?.run) throw new Error('Missing Playwright version step')
  const dir = mkdtempSync(join(tmpdir(), 'playwright-version-'))
  try {
    writeFileSync(join(dir, 'pnpm-lock.yaml'), lockfile)
    const output = join(dir, 'output')
    writeFileSync(output, '')
    const result = spawnSync(
      'bash',
      ['--noprofile', '--norc', '-c', step.run],
      {
        cwd: dir,
        env: { PATH: process.env.PATH, GITHUB_OUTPUT: output },
        encoding: 'utf8'
      }
    )
    return { status: result.status, output: readFileSync(output, 'utf8') }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('merge-reports Playwright version', () => {
  it.for([
    [
      'root importer version',
      lockfileWithPlaywright('1.2.0', '1.3.0'),
      0,
      'version=1.3.0\n'
    ],
    [
      'peer suffix stripped',
      lockfileWithPlaywright('1.2.0', '1.3.0(foo@1.0.0)'),
      0,
      'version=1.3.0\n'
    ],
    [
      'missing root entry',
      'importers:\n  .:\n    devDependencies: {}\n',
      1,
      ''
    ],
    [
      'root entry without a version',
      [
        'importers:',
        '  .:',
        '    devDependencies:',
        "      '@playwright/test':",
        '        specifier: ^1.0.0',
        "      '@vitest/ui':",
        '        specifier: ^1.0.0',
        '        version: 9.9.9',
        ''
      ].join('\n'),
      1,
      ''
    ]
  ] as const)('%s', ([, lockfile, status, output]) => {
    expect(readLockedPlaywrightVersion(lockfile)).toEqual({ status, output })
  })

  it('checks out the lockfile it reads', () => {
    expect(pipeline.jobs['merge-reports'].steps).toContainEqual(
      expect.objectContaining({
        uses: expect.stringMatching(/^actions\/checkout@/),
        with: expect.objectContaining({
          'sparse-checkout': expect.stringMatching(/^\/pnpm-lock\.yaml$/m)
        })
      })
    )
  })

  it('merges the HTML and JSON reports with the locked version', () => {
    const step = pipeline.jobs['merge-reports'].steps?.find((candidate) =>
      candidate.run?.includes('merge-reports')
    )
    if (!step?.run) throw new Error('Missing merge-reports step')
    expect(step.env).toEqual({
      PLAYWRIGHT_VERSION: '${{ steps.playwright-version.outputs.version }}'
    })
    const dir = mkdtempSync(join(tmpdir(), 'merge-reports-'))
    try {
      const calls = join(dir, 'calls')
      writeFileSync(
        join(dir, 'pnpm'),
        `#!/bin/bash\necho "\${PLAYWRIGHT_JSON_OUTPUT_NAME:-} $*" >> "${calls}"\n`,
        { mode: 0o755 }
      )
      const result = spawnSync(
        'bash',
        ['--noprofile', '--norc', '-eo', 'pipefail', '-c', step.run],
        {
          cwd: dir,
          env: {
            PATH: `${dir}:${process.env.PATH}`,
            PLAYWRIGHT_VERSION: '1.3.0'
          },
          encoding: 'utf8'
        }
      )
      expect(result.status).toBe(0)
      expect(readFileSync(calls, 'utf8')).toBe(
        [
          ' dlx @playwright/test@1.3.0 merge-reports --reporter=html ./all-blob-reports',
          'playwright-report/report.json dlx @playwright/test@1.3.0 merge-reports --reporter=json ./all-blob-reports',
          ''
        ].join('\n')
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('matches the root importer in the repository lockfile', () => {
    const lockfile = readFileSync('pnpm-lock.yaml', 'utf8')
    const root = z
      .object({
        importers: z.object({
          '.': z.object({
            devDependencies: z.object({
              '@playwright/test': z.object({ version: z.string() })
            })
          })
        })
      })
      .parse(parse(lockfile))
    expect(readLockedPlaywrightVersion(lockfile)).toEqual({
      status: 0,
      output: `version=${root.importers['.'].devDependencies['@playwright/test'].version.replace(/\(.*/, '')}\n`
    })
  })
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
