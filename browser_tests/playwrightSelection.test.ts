import { spawnSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

function collectLiveBilling(enabled: '0' | '1', args: string[]) {
  const result = spawnSync(
    'pnpm',
    ['exec', 'playwright', 'test', ...args, '--list', '--reporter=json'],
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
  const report = z
    .object({
      suites: z.array(
        z.object({
          suites: z.array(
            z.object({ specs: z.array(z.object({ file: z.string() })) })
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
  const files = report.suites.flatMap((suite) =>
    suite.suites.flatMap((child) =>
      child.specs.map((spec) => spec.file.replaceAll('\\', '/'))
    )
  )
  return { status: result.status, config: report.config, files }
}

describe('Live billing opt-in', () => {
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
    { name: 'with a project filter', args: ['--project=cloud-live'] }
  ])(
    'collects only live billing when enabled $name',
    { timeout: 90_000 },
    ({ args }) => {
      const { status, config, files } = collectLiveBilling('1', args)
      expect(status).toBe(0)
      expect(config.projects.map((project) => project.name)).toEqual([
        'cloud-live'
      ])
      expect(files.every((file) => file.startsWith('tests/liveCloud/'))).toBe(
        true
      )
      expect(files).toEqual(
        expect.arrayContaining(['tests/liveCloud/billingSmoke.spec.ts'])
      )
      expect(config.globalSetup).toBeFalsy()
      expect(config.globalTeardown).toBeFalsy()
    }
  )
})
