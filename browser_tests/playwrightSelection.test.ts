import { spawnSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

describe('Live billing opt-in', () => {
  it.for([
    {
      name: 'disabled',
      enabled: '0',
      args: ['tests/liveCloud'],
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
      expect(result.status).toBe(status)
      const report = z
        .object({
          suites: z.array(z.unknown()),
          config: z.object({
            globalSetup: z.unknown(),
            globalTeardown: z.unknown(),
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
