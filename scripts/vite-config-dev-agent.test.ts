// @vitest-environment node
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const printAgentConfig =
  "import('./vite.config.mts').then(({ default: config }) => process.stdout.write(JSON.stringify({ headers: config.server?.proxy?.['/api/agent']?.headers, workflowsHeaders: config.server?.proxy?.['/api/workflows']?.headers, host: config.server?.host })))"

async function importConfig(
  devAgentUrl: string,
  overrides: NodeJS.ProcessEnv = {}
) {
  return await execFileAsync(
    process.execPath,
    ['--import', 'tsx', '--eval', printAgentConfig],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DEV_AGENT_SESSION_TOKEN: 'test-session-token',
        DEV_AGENT_URL: devAgentUrl,
        VITE_AGENT_STANDALONE: undefined,
        VITE_REMOTE_DEV: undefined,
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

// Both agent routes — /api/agent and the saved-workflow index at
// /api/workflows — must carry the same session and credential headers.
function expectAgentHeaders(stdout: string, headers: Record<string, string>) {
  expect(JSON.parse(stdout)).toEqual({ headers, workflowsHeaders: headers })
}

describe('dev agent comfy credential', () => {
  it('forwards the token while keeping the dev server local', async () => {
    const { stdout } = await importConfig('http://127.0.0.1:8095', {
      DEV_AGENT_COMFY_TOKEN: 'comfyui-test-key',
      VITE_REMOTE_DEV: 'true'
    })
    expectAgentHeaders(stdout, {
      'X-Comfy-Agent-Session': 'test-session-token',
      'X-API-KEY': 'comfyui-test-key'
    })
  })

  it('refuses to bind all interfaces while holding a comfy credential', async () => {
    const { stdout } = await importConfig('http://127.0.0.1:8095', {
      DEV_AGENT_COMFY_TOKEN: 'comfyui-test-key',
      VITE_REMOTE_DEV: 'true'
    })
    expect(stdout).not.toContain('0.0.0.0')
  })

  it('presents a non-key token as the bearer, the way ingest reads it', async () => {
    const { stdout } = await importConfig('http://127.0.0.1:8095', {
      DEV_AGENT_COMFY_TOKEN: 'a-firebase-jwt'
    })
    expectAgentHeaders(stdout, {
      'X-Comfy-Agent-Session': 'test-session-token',
      Authorization: 'Bearer a-firebase-jwt'
    })
  })

  it('omits the comfy header when the token is unset', async () => {
    const { stdout } = await importConfig('http://127.0.0.1:8095', {
      DEV_AGENT_COMFY_TOKEN: undefined
    })
    expectAgentHeaders(stdout, {
      'X-Comfy-Agent-Session': 'test-session-token'
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
