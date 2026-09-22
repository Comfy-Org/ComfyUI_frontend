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
      expect([...new Set(files)].sort()).toEqual(expectedFiles.sort())
      expect(config.globalSetup).toBeFalsy()
      expect(config.globalTeardown).toBeFalsy()
    }
  )
})
