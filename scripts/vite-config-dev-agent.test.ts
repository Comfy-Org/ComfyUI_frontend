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
  it('loads when a comfy token accompanies a protected target', async () => {
    await expect(
      importConfig('http://127.0.0.1:8095', {
        DEV_AGENT_COMFY_TOKEN: 'comfyui-test-key'
      })
    ).resolves.toBeDefined()
  })

  it('rejects a comfy token with no agent target to forward it to', async () => {
    await expect(
      importConfig('', {
        DEV_AGENT_COMFY_TOKEN: 'comfyui-test-key',
        DEV_AGENT_SESSION_TOKEN: undefined
      })
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        'DEV_AGENT_COMFY_TOKEN requires DEV_AGENT_URL'
      )
    })
  })

  it('warns rather than failing when standalone runs without a comfy token', async () => {
    const result = await importConfig('http://127.0.0.1:8095', {
      VITE_AGENT_STANDALONE: 'true',
      DEV_AGENT_COMFY_TOKEN: undefined
    })
    expect(result.stderr).toContain('DEV_AGENT_COMFY_TOKEN is not set')
  })
})
