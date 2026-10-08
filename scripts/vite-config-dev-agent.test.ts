// @vitest-environment node
import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { afterAll, describe, expect, it } from 'vitest'

import { createDevAgentConfig } from '../build/devAgentConfig'

const execFileAsync = promisify(execFile)
const agentDataDir = mkdtempSync(join(tmpdir(), 'vite-agent-config-'))
afterAll(() => rmSync(agentDataDir, { force: true, recursive: true }))
const printAgentConfig =
  "import('./vite.config.mts').then(({ default: config }) => process.stdout.write(JSON.stringify({ headers: config.server?.proxy?.['/api/agent']?.headers, host: config.server?.host })))"

describe('dev agent proxy transport', () => {
  it.for([
    'https://agent.example.com',
    'http://localhost:8095',
    'http://127.0.0.1:8095',
    'http://[::1]:8095'
  ])('accepts a protected target at %s', (url) => {
    const { host, proxy } = createDevAgentConfig({
      DEV_AGENT_URL: url,
      DEV_AGENT_SESSION_TOKEN: 'test-session-token'
    })
    expect(host).toBeUndefined()
    expect(proxy).toMatchObject({
      target: url,
      headers: { Authorization: 'Bearer test-session-token' }
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
    { DEV_AGENT_SESSION_TOKEN: 'test-session-token' },
    { DEV_AGENT_DATA_DIR: '/tmp/comfy-agent' }
  ])('requires both target and a token source: %j', (env) => {
    expect(() => createDevAgentConfig(env)).toThrow(
      'DEV_AGENT_URL needs exactly one token source, and a token source needs DEV_AGENT_URL'
    )
  })

  it('refuses two sources for the same credential', () => {
    expect(() =>
      createDevAgentConfig({
        DEV_AGENT_URL: 'http://127.0.0.1:6286',
        DEV_AGENT_SESSION_TOKEN: 'test-session-token',
        DEV_AGENT_DATA_DIR: '/tmp/comfy-agent'
      })
    ).toThrow('two sources for the same credential')
  })

  it('treats an empty data directory as no discovery source at all', () => {
    const { proxy } = createDevAgentConfig({
      DEV_AGENT_URL: 'http://127.0.0.1:6286',
      DEV_AGENT_SESSION_TOKEN: 'test-session-token',
      DEV_AGENT_DATA_DIR: ''
    })
    expect(proxy).toMatchObject({
      headers: { Authorization: 'Bearer test-session-token' }
    })
  })

  it('rejects an unavailable discovery directory at configuration time', () => {
    expect(() =>
      createDevAgentConfig({
        DEV_AGENT_URL: 'http://127.0.0.1:6286',
        DEV_AGENT_DATA_DIR: join(agentDataDir, 'missing')
      })
    ).toThrow('DEV_AGENT_DATA_DIR must be an existing readable directory')
  })

  it.for(['http://agent.example.com', 'http://localhost.example.com'])(
    'rejects forwarding a discovery credential to %s',
    (url) => {
      expect(() =>
        createDevAgentConfig({
          DEV_AGENT_URL: url,
          DEV_AGENT_DATA_DIR: '/tmp/comfy-agent'
        })
      ).toThrow('DEV_AGENT_URL must use https unless it targets loopback')
    }
  )

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
    const { host, proxy } = createDevAgentConfig({
      DEV_AGENT_URL: 'http://127.0.0.1:8095',
      DEV_AGENT_SESSION_TOKEN: 'test-session-token',
      DEV_AGENT_COMFY_TOKEN: 'comfyui-test-key',
      VITE_REMOTE_DEV: 'true'
    })
    expect(host).toBeUndefined()
    expect(proxy).toMatchObject({
      target: 'http://127.0.0.1:8095',
      headers: {
        Authorization: 'Bearer test-session-token',
        'X-Comfy-Token': 'comfyui-test-key'
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
