// @vitest-environment node
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const printAgentConfig =
  "import('./vite.config.mts').then(({ default: config }) => process.stdout.write(JSON.stringify({ headers: config.server?.proxy?.['/api/agent']?.headers, host: config.server?.host })))"

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

describe('dev agent comfy credential', () => {
  it('forwards the token while keeping the dev server local', async () => {
    const { stdout } = await importConfig('http://127.0.0.1:8095', {
      DEV_AGENT_COMFY_TOKEN: 'comfyui-test-key',
      VITE_REMOTE_DEV: 'true'
    })
    expect(stdout).toBe(
      '{"headers":{"Authorization":"Bearer test-session-token","X-Comfy-Token":"comfyui-test-key"}}'
    )
  })

  it('refuses to bind all interfaces while holding a comfy credential', async () => {
    const { stdout } = await importConfig('http://127.0.0.1:8095', {
      DEV_AGENT_COMFY_TOKEN: 'comfyui-test-key',
      VITE_REMOTE_DEV: 'true'
    })
    expect(stdout).not.toContain('0.0.0.0')
  })

  it('omits the comfy header when the token is unset', async () => {
    const { stdout } = await importConfig('http://127.0.0.1:8095', {
      DEV_AGENT_COMFY_TOKEN: undefined
    })
    expect(stdout).toBe(
      '{"headers":{"Authorization":"Bearer test-session-token"}}'
    )
  })
})
