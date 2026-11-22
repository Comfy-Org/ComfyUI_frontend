import { spawnSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

describe('Live billing opt-in', () => {
  it.for([
    {
      name: 'disabled',
      enabled: '0',
      args: [],
      status: 1,
      count: 0,
      hooks: true
    },
    {
      name: 'enabled without a project filter',
      enabled: '1',
      args: [],
      status: 0,
      count: 1,
      hooks: false
    },
    {
      name: 'enabled with a project filter',
      enabled: '1',
      args: ['--project=cloud-live'],
      status: 0,
      count: 1,
      hooks: false
    }
  ])(
    'collects live billing only when explicitly enabled: $name',
    { timeout: 90_000 },
    ({ enabled, args, status, count, hooks }) => {
      const result = spawnSync(
        'pnpm',
        [
          'exec',
          'playwright',
          'test',
          'tests/liveCloud/billingSmoke.spec.ts',
          ...args,
          '--list',
          '--reporter=json'
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            PLAYWRIGHT_CLOUD_LIVE: enabled,
            DISTRIBUTION: 'cloud'
          },
          encoding: 'utf8',
          timeout: 60_000,
          maxBuffer: 10_000_000
        }
      )
      expect(result.error).toBeUndefined()
      expect(result.status).toBe(status)
      const report = z
        .object({
          suites: z.array(z.unknown()),
          config: z.object({
            globalSetup: z.unknown().optional(),
            globalTeardown: z.unknown().optional(),
            projects: z.array(z.object({ name: z.string() }))
          })
        })
        .parse(JSON.parse(result.stdout))
      expect(
        report.config.projects.some((project) => project.name === 'cloud-live')
      ).toBe(enabled === '1')
      expect(
        report.config.projects.every((project) => project.name === 'cloud-live')
      ).toBe(!hooks)
      const suites = z
        .array(
          z.object({
            suites: z.array(z.object({ specs: z.array(z.unknown()) }))
          })
        )
        .parse(report.suites)
      const specs = suites.flatMap((suite) =>
        suite.suites.flatMap((child) => child.specs)
      )
      expect(specs).toHaveLength(count)
      expect(Boolean(report.config.globalSetup)).toBe(hooks)
      expect(Boolean(report.config.globalTeardown)).toBe(hooks)
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
