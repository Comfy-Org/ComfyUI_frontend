// @vitest-environment node
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

import { createDevAgentConfig } from '../build/devAgentConfig'

const execFileAsync = promisify(execFile)
const printAgentConfig =
  "import('./vite.config.mts').then(({ default: config }) => process.stdout.write(JSON.stringify({ headers: config.server?.proxy?.['/api/agent']?.headers, host: config.server?.host })))"

describe('dev agent proxy transport', () => {
  it.for([
    'https://agent.example.com',
    'http://localhost:8095',
    'http://127.0.0.1:8095',
    'http://[::1]:8095'
  ])('accepts a protected target at %s', (url) => {
    expect(
      createDevAgentConfig({
        DEV_AGENT_URL: url,
        DEV_AGENT_SESSION_TOKEN: 'test-session-token'
      })
    ).toEqual({
      host: undefined,
      proxy: {
        target: url,
        headers: { Authorization: 'Bearer test-session-token' }
      }
    })
  })

  it.for([
    'http://agent.example.com',
    'http://localhost.example.com',
    'ftp://localhost:8095'
  ])('rejects forwarding credentials to %s', (url) => {
    expect(() =>
      createDevAgentConfig({
        DEV_AGENT_URL: url,
        DEV_AGENT_SESSION_TOKEN: 'test-session-token'
      })
    ).toThrow('DEV_AGENT_URL must use https unless it targets loopback')
  })

  it.for([
    { DEV_AGENT_URL: 'https://agent.example.com' },
    { DEV_AGENT_SESSION_TOKEN: 'test-session-token' }
  ])('requires both target and session token: %j', (env) => {
    expect(() => createDevAgentConfig(env)).toThrow(
      'DEV_AGENT_URL and DEV_AGENT_SESSION_TOKEN must be configured together'
    )
  })

  it('requires an agent proxy in standalone mode', () => {
    expect(() =>
      createDevAgentConfig({ VITE_AGENT_STANDALONE: 'true' })
    ).toThrow('VITE_AGENT_STANDALONE requires DEV_AGENT_URL')
  })

  it('leaves the proxy disabled when no target or token is set', () => {
    expect(createDevAgentConfig({})).toEqual({
      host: undefined,
      proxy: undefined
    })
  })
})

describe('dev agent comfy credential', () => {
  it('forwards the token while keeping the dev server local', () => {
    expect(
      createDevAgentConfig({
        DEV_AGENT_URL: 'http://127.0.0.1:8095',
        DEV_AGENT_SESSION_TOKEN: 'test-session-token',
        DEV_AGENT_COMFY_TOKEN: 'comfyui-test-key',
        VITE_REMOTE_DEV: 'true'
      })
    ).toEqual({
      host: undefined,
      proxy: {
        target: 'http://127.0.0.1:8095',
        headers: {
          Authorization: 'Bearer test-session-token',
          'X-Comfy-Token': 'comfyui-test-key'
        }
      }
    })
  })

  it('allows remote development without a comfy credential', () => {
    expect(createDevAgentConfig({ VITE_REMOTE_DEV: 'true' }).host).toBe(
      '0.0.0.0'
    )
  })

  it(
    'wires the headers and local-only host into the Vite config',
    { timeout: 30_000 },
    async () => {
      const { stdout } = await execFileAsync(
        process.execPath,
        ['--import', 'tsx', '--eval', printAgentConfig],
        {
          cwd: process.cwd(),
          timeout: 25_000,
          env: {
            ...process.env,
            DEV_AGENT_URL: 'http://127.0.0.1:8095',
            DEV_AGENT_SESSION_TOKEN: 'test-session-token',
            DEV_AGENT_COMFY_TOKEN: 'comfyui-test-key',
            VITE_AGENT_STANDALONE: 'true',
            VITE_REMOTE_DEV: 'true'
          }
        }
      )
      expect(stdout).toBe(
        '{"headers":{"Authorization":"Bearer test-session-token","X-Comfy-Token":"comfyui-test-key"}}'
      )
    }
  )
})
