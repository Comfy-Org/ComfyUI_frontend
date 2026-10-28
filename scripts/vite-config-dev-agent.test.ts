// @vitest-environment node
import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { afterAll, describe, expect, it } from 'vitest'

import {
  createDevAgentConfig,
  devServerAgentRoutes
} from '../build/devAgentConfig'

const execFileAsync = promisify(execFile)
const agentDataDir = mkdtempSync(join(tmpdir(), 'vite-agent-config-'))
afterAll(() => rmSync(agentDataDir, { force: true, recursive: true }))
const printAgentConfig =
  "import('./vite.config.mts').then(({ default: config }) => process.stdout.write(JSON.stringify({ headers: config.server?.proxy?.['/api/agent']?.headers, workflowsHeaders: config.server?.proxy?.['/api/workflows']?.headers, host: config.server?.host, proxyCredential: config.define?.['import.meta.env.VITE_DEV_AGENT_PROXY_CREDENTIAL'] })))"

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
      headers: { 'X-Comfy-Agent-Session': 'test-session-token' }
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
      headers: { 'X-Comfy-Agent-Session': 'test-session-token' }
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

  it(
    'refuses the standalone harness when the dev server URL selects the cloud distribution',
    { timeout: 30_000 },
    async () => {
      await expect(
        execFileAsync(
          process.execPath,
          ['--import', 'tsx', '--eval', printAgentConfig],
          {
            cwd: process.cwd(),
            timeout: 25_000,
            env: {
              ...process.env,
              DEV_AGENT_URL: 'http://127.0.0.1:8095',
              DEV_AGENT_SESSION_TOKEN: 'test-session-token',
              DEV_AGENT_DATA_DIR: '',
              VITE_AGENT_STANDALONE: 'true',
              DEV_SERVER_COMFYUI_URL: 'https://testcloud.comfy.org/',
              DISTRIBUTION: ''
            }
          }
        )
      ).rejects.toThrow(
        'VITE_AGENT_STANDALONE cannot be combined with DISTRIBUTION=cloud'
      )
    }
  )

  it('allows the agent proxy in a cloud distribution without the standalone harness', () => {
    expect(
      createDevAgentConfig(
        {
          DEV_AGENT_URL: 'http://127.0.0.1:8095',
          DEV_AGENT_SESSION_TOKEN: 'test-session-token'
        },
        'cloud'
      ).proxy
    ).toMatchObject({ target: 'http://127.0.0.1:8095' })
  })

  it('leaves the proxy disabled when no target or token is set', () => {
    expect(createDevAgentConfig({})).toEqual({
      host: undefined,
      proxy: undefined,
      proxySuppliesCredential: false
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
        'X-Comfy-Agent-Session': 'test-session-token',
        'X-API-KEY': 'comfyui-test-key'
      }
    })
  })

  it('presents a non-key token as the bearer, the way ingest reads it', () => {
    expect(
      createDevAgentConfig({
        DEV_AGENT_URL: 'http://127.0.0.1:8095',
        DEV_AGENT_SESSION_TOKEN: 'test-session-token',
        DEV_AGENT_COMFY_TOKEN: 'a-firebase-jwt'
      }).proxy?.headers
    ).toEqual({
      'X-Comfy-Agent-Session': 'test-session-token',
      Authorization: 'Bearer a-firebase-jwt'
    })
  })

  it.for([
    {
      label: 'a proxy with a comfy credential',
      env: {
        DEV_AGENT_URL: 'http://127.0.0.1:8095',
        DEV_AGENT_SESSION_TOKEN: 'test-session-token',
        DEV_AGENT_COMFY_TOKEN: 'comfyui-test-key'
      },
      supplies: true
    },
    {
      label: 'a proxy without one',
      env: {
        DEV_AGENT_URL: 'http://127.0.0.1:8095',
        DEV_AGENT_SESSION_TOKEN: 'test-session-token'
      },
      supplies: false
    },
    {
      label: 'a comfy credential without a proxy',
      env: { DEV_AGENT_COMFY_TOKEN: 'comfyui-test-key' },
      supplies: false
    }
  ])(
    'reports whether the proxy supplies a credential for $label',
    ({ env, supplies }) => {
      expect(createDevAgentConfig(env).proxySuppliesCredential).toBe(supplies)
    }
  )

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
            VITE_REMOTE_DEV: 'true',
            DEV_SERVER_COMFYUI_URL: '',
            DEV_AGENT_DATA_DIR: '',
            DISTRIBUTION: ''
          }
        }
      )
      const headers = {
        'X-Comfy-Agent-Session': 'test-session-token',
        'X-API-KEY': 'comfyui-test-key'
      }
      expect(JSON.parse(stdout)).toEqual({
        headers,
        workflowsHeaders: headers,
        proxyCredential: '"true"'
      })
    }
  )
})

describe('dev server agent routes', () => {
  const agentProxy = { target: 'http://127.0.0.1:8095', ws: true }
  const backend = { target: 'https://cloud.example.com' }

  it('upgrades the events socket on the backend without a local agent', () => {
    expect(devServerAgentRoutes(undefined, backend)).toEqual({
      '/api/agent/events': { target: 'https://cloud.example.com', ws: true }
    })
  })

  it('routes the agent and the saved-workflow index to a local agent first', () => {
    expect(Object.entries(devServerAgentRoutes(agentProxy, backend))).toEqual([
      ['/api/workflows', agentProxy],
      ['/api/agent', agentProxy],
      ['/api/agent/events', { target: 'https://cloud.example.com', ws: true }]
    ])
  })
})
