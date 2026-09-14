// @vitest-environment node
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)

async function importConfig(
  devAgentUrl: string,
  overrides: Record<string, string | undefined> = {}
) {
  return await execFileAsync(
    process.execPath,
    ['--import', 'tsx', '--eval', "import('./vite.config.mts')"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DEV_AGENT_SESSION_TOKEN: 'test-session-token',
        DEV_AGENT_URL: devAgentUrl,
        VITE_AGENT_STANDALONE: undefined,
        DISTRIBUTION: undefined,
        ...overrides
      }
    }
  )
}

describe('dev agent proxy transport', () => {
  it.for([
    'https://agent.example.com',
    'http://localhost:8095',
    'http://127.0.0.1:8095',
    'http://[::1]:8095'
  ])('accepts a protected target at %s', async (devAgentUrl) => {
    await expect(importConfig(devAgentUrl)).resolves.toBeDefined()
  })

  it('rejects forwarding credentials to remote cleartext targets', async () => {
    await expect(
      importConfig('http://agent.example.com')
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        'DEV_AGENT_URL must use https unless it targets loopback'
      )
    })
  })
})

describe('standalone agent harness distribution guard', () => {
  // VITE_AGENT_STANDALONE forces the agent panel on for every user of the
  // bundle it is baked into (extensions/core/agentPanel.ts), independent of
  // the distribution. A cloud bundle built with it would ship that to
  // production, so the build refuses the combination outright.
  it('refuses to bake the standalone harness into a cloud distribution', async () => {
    await expect(
      importConfig('http://127.0.0.1:8095', {
        DISTRIBUTION: 'cloud',
        VITE_AGENT_STANDALONE: 'true'
      })
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('never a cloud distribution')
    })
  })

  it.for(['localhost', 'desktop', undefined])(
    'accepts the standalone harness for the %s distribution',
    async (distribution) => {
      await expect(
        importConfig('http://127.0.0.1:8095', {
          DISTRIBUTION: distribution,
          VITE_AGENT_STANDALONE: 'true'
        })
      ).resolves.toBeDefined()
    }
  )
})
