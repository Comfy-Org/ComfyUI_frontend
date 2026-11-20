import { globSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

function collectLiveBilling(
  enabled: '0' | '1',
  args: string[],
  releaseSmoke = '0'
) {
  const result = spawnSync(
    'pnpm',
    ['exec', 'playwright', 'test', ...args, '--list', '--reporter=json'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLAYWRIGHT_CLOUD_LIVE: enabled,
        PLAYWRIGHT_CLOUD_RELEASE_SMOKE: releaseSmoke,
        DISTRIBUTION: 'cloud'
      },
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 10_000_000
    }
  )
  expect(result.error).toBeUndefined()
  const report = z
    .object({
      suites: z.array(
        z.object({
          suites: z.array(
            z.object({
              specs: z.array(
                z.object({
                  file: z.string(),
                  tests: z.array(z.object({ projectName: z.string() }))
                })
              )
            })
          )
        })
      ),
      config: z.object({
        globalSetup: z.unknown(),
        globalTeardown: z.unknown(),
        projects: z.array(z.object({ name: z.string() }))
      })
    })
    .parse(JSON.parse(result.stdout))
  const specs = report.suites.flatMap((suite) =>
    suite.suites.flatMap((child) => child.specs)
  )
  const files = specs.map((spec) => spec.file.replaceAll('\\', '/'))
  return { status: result.status, config: report.config, files, specs }
}

describe('Live billing opt-in', () => {
  it(
    'collects release checkout only with its opt-in',
    { timeout: 90_000 },
    () => {
      const args = ['--project=cloud-live', 'releaseSmoke.spec.ts']
      expect(collectLiveBilling('1', args).files).toEqual([])
      expect(collectLiveBilling('1', args, '1').files).toEqual([
        'tests/liveCloud/releaseSmoke.spec.ts'
      ])
    }
  )

  it('excludes live billing when disabled', { timeout: 90_000 }, () => {
    const { status, config, files } = collectLiveBilling('0', [
      'tests/liveCloud'
    ])
    expect(status).toBe(1)
    expect(config.projects.map((project) => project.name)).not.toContain(
      'cloud-live'
    )
    expect(files).toEqual([])
    expect(config.globalSetup).toBeTruthy()
    expect(config.globalTeardown).toBeTruthy()
  })

  it.for([
    { name: 'without a project filter', args: [] },
    {
      name: 'with a project filter',
      args: [
        '--project=cloud-live',
        '--project=cloud-live-disposable',
        '--project=cloud-live-paid'
      ]
    }
  ])(
    'collects only live billing when enabled $name',
    { timeout: 90_000 },
    ({ args }) => {
      const { status, config, files, specs } = collectLiveBilling('1', args)
      expect(status).toBe(0)
      expect(config.projects.map((project) => project.name)).toEqual([
        'cloud-live',
        'cloud-live-disposable',
        'cloud-live-paid'
      ])
      expect(files.every((file) => file.startsWith('tests/liveCloud/'))).toBe(
        true
      )
      for (const spec of specs) {
        const file = spec.file.replaceAll('\\', '/')
        const project = file.startsWith('tests/liveCloud/disposable/')
          ? 'cloud-live-disposable'
          : file.startsWith('tests/liveCloud/paid/')
            ? 'cloud-live-paid'
            : 'cloud-live'
        expect(spec.tests.map((test) => test.projectName)).toEqual([project])
      }
      const expectedFiles = globSync(
        'browser_tests/tests/liveCloud/**/*.spec.ts'
      )
        .map((file) => file.replace('browser_tests/', '').replaceAll('\\', '/'))
        .filter((file) => file !== 'tests/liveCloud/releaseSmoke.spec.ts')
      const selectedFiles = [...new Set(files)]
      expect(selectedFiles).toHaveLength(expectedFiles.length)
      expect(selectedFiles).toEqual(expect.arrayContaining(expectedFiles))
      expect(config.globalSetup).toBeFalsy()
      expect(config.globalTeardown).toBeFalsy()
    }
  )
})

const specSchema = z.object({
  title: z.string(),
  file: z.string(),
  tags: z.array(z.string()).default([])
})
type CollectedSpec = z.infer<typeof specSchema>

const suiteSchema: z.ZodType<{
  specs: CollectedSpec[]
  suites?: unknown[]
}> = z.lazy(() =>
  z.object({
    specs: z.array(specSchema).default([]),
    suites: z.array(suiteSchema).default([])
  })
)

type CollectedSuite = z.infer<typeof suiteSchema>

function flattenNestedSuites(suites: CollectedSuite[]): CollectedSpec[] {
  return suites.flatMap((suite) => [
    ...suite.specs,
    ...flattenNestedSuites((suite.suites ?? []) as CollectedSuite[])
  ])
}

function collectSpecs(project: string, args: string[] = []): CollectedSpec[] {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'playwright',
      'test',
      `--project=${project}`,
      ...args,
      '--list',
      '--reporter=json'
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLAYWRIGHT_CLOUD_LIVE: project === 'cloud-live' ? '1' : '0',
        DISTRIBUTION: 'cloud'
      },
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 50_000_000
    }
  )
  expect(result.error).toBeUndefined()
  if (result.status !== 0) {
    throw new Error(
      `playwright --list failed for project ${project}: ${result.stderr}`
    )
  }
  const report = z
    .object({ suites: z.array(suiteSchema) })
    .parse(JSON.parse(result.stdout))
  return flattenNestedSuites(report.suites)
}

const STAGING_SMOKE_FILE = 'tests/liveCloud/stagingSmoke.spec.ts'
const TAGS_THAT_MOCK_AUTH_BILLING_AND_WORKSPACE = /cloud|auth/

describe('Staging smoke gate selection', { timeout: 300_000 }, () => {
  it('selects exactly the staging smoke spec under its tag', () => {
    const specs = collectSpecs('cloud-live', ['--grep', '@staging-smoke'])
    expect(specs.map((spec) => spec.file)).toEqual([STAGING_SMOKE_FILE])
    expect(specs[0].tags).toContain('staging-smoke')
  })

  it('carries no tag that would make the shared fixture mock auth, billing and workspace', () => {
    const [spec] = collectSpecs('cloud-live', ['--grep', '@staging-smoke'])
    expect(
      spec.tags.filter((tag) =>
        TAGS_THAT_MOCK_AUTH_BILLING_AND_WORKSPACE.test(tag)
      )
    ).toEqual([])
  })

  it.for(['cloud', 'chromium'])(
    'keeps the live suite out of the %s pre-merge collection, as testIgnore intends',
    (project) => {
      const leakedLiveSpecs = collectSpecs(project).filter((spec) =>
        spec.file.includes('liveCloud/')
      )
      expect(leakedLiveSpecs.map((spec) => spec.file)).toEqual([])
    }
  )

  it('needs the tag filter, because the bare cloud-live project is mostly local-SUT specs', () => {
    const collectedFiles = collectSpecs('cloud-live').map((spec) => spec.file)
    expect(collectedFiles).toContain(STAGING_SMOKE_FILE)
    expect(
      collectedFiles.filter((file) => file !== STAGING_SMOKE_FILE).length
    ).toBeGreaterThan(0)
  })
})
