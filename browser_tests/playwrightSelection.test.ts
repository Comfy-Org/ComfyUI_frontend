import { spawnSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

describe('Live billing opt-in', () => {
  it.for([
    { enabled: '0', project: 'cloud-live', count: 0 },
    { enabled: '1', project: 'cloud-live', count: 3 },
    { enabled: '1', project: 'cloud-live-paid', count: 2 },
    { enabled: '1', project: 'cloud-live-disposable', count: 7 }
  ])(
    'collects $project only when explicitly enabled ($enabled)',
    { timeout: 90_000 },
    ({ enabled, project, count }) => {
      const result = spawnSync(
        'pnpm',
        [
          'exec',
          'playwright',
          'test',
          ...(enabled === '1' ? [`--project=${project}`] : ['tests/liveCloud']),
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
      expect(result.status).toBe(enabled === '1' ? 0 : 1)
      const report = z
        .object({
          suites: z.array(
            z.object({
              suites: z.array(z.object({ specs: z.array(z.unknown()) }))
            })
          ),
          config: z.object({
            globalSetup: z.unknown(),
            globalTeardown: z.unknown()
          })
        })
        .parse(JSON.parse(result.stdout))
      const specs = report.suites.flatMap((suite) =>
        suite.suites.flatMap((child) => child.specs)
      )
      expect(specs).toHaveLength(count)
      if (enabled === '1') {
        expect(report.config.globalSetup).toBeNull()
        expect(report.config.globalTeardown).toBeNull()
      }
    }
  )
})
