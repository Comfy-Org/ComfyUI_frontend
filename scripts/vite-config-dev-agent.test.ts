// @vitest-environment node
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

import { createDevAgentConfig } from '../build/devAgentConfig'

const execFileAsync = promisify(execFile)
const printAgentConfig =
  "import('./vite.config.mts').then(({ default: config }) => process.stdout.write(JSON.stringify({ headers: config.server?.proxy?.['/api/agent']?.headers, workflowsHeaders: config.server?.proxy?.['/api/workflows']?.headers, host: config.server?.host })))"

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
        headers: { 'X-Comfy-Agent-Session': 'test-session-token' }
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

  // The standalone harness forces the panel on for every user of its bundle,
  // so a cloud bundle carrying it would ship the panel to everyone.
  it('refuses the standalone harness in a cloud distribution', () => {
    expect(() =>
      createDevAgentConfig({
        DEV_AGENT_URL: 'http://127.0.0.1:8095',
        DEV_AGENT_SESSION_TOKEN: 'test-session-token',
        VITE_AGENT_STANDALONE: 'true',
        DISTRIBUTION: 'cloud'
      })
    ).toThrow(
      'VITE_AGENT_STANDALONE cannot be combined with DISTRIBUTION=cloud'
    )
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
          'X-Comfy-Agent-Session': 'test-session-token',
          'X-API-KEY': 'comfyui-test-key'
        }
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
            DISTRIBUTION: undefined
          }
        }
      )
      // Both agent routes, /api/agent and the saved-workflow index at
      // /api/workflows, carry the same session and credential headers.
      const headers = {
        'X-Comfy-Agent-Session': 'test-session-token',
        'X-API-KEY': 'comfyui-test-key'
      }
      expect(JSON.parse(stdout)).toEqual({ headers, workflowsHeaders: headers })
    }
  )
})

// The events socket must be proxied as a WebSocket in every dev setup: the
// catch-all /api route proxies plain HTTP only. With a local agent the
// /api/agent route (which also upgrades) must match first.
const printProxyRoutes =
  "import('./vite.config.mts').then(({ default: config }) => { const proxy = config.server?.proxy ?? {}; process.stdout.write(JSON.stringify({ order: Object.keys(proxy), eventsWs: proxy['/api/agent/events']?.ws ?? null, agentWs: proxy['/api/agent']?.ws ?? null })) })"

async function proxyRoutes(overrides: NodeJS.ProcessEnv) {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--import', 'tsx', '--eval', printProxyRoutes],
    {
      cwd: process.cwd(),
      timeout: 25_000,
      env: {
        ...process.env,
        VITE_AGENT_STANDALONE: undefined,
        VITE_REMOTE_DEV: undefined,
        DISTRIBUTION: undefined,
        DEV_AGENT_URL: undefined,
        DEV_AGENT_SESSION_TOKEN: undefined,
        ...overrides
      }
    }
  )
  return JSON.parse(stdout) as {
    order: string[]
    eventsWs: boolean | null
    agentWs: boolean | null
  }
}

describe('agent events socket dev proxy', () => {
  it(
    'upgrades /api/agent/events ahead of the plain /api route without a local agent',
    { timeout: 30_000 },
    async () => {
      const routes = await proxyRoutes({ DISTRIBUTION: 'cloud' })

      expect(routes.eventsWs).toBe(true)
      expect(routes.order.indexOf('/api/agent/events')).toBeLessThan(
        routes.order.indexOf('/api')
      )
    }
  )

  it(
    'lets the local agent route, which also upgrades, match first',
    { timeout: 30_000 },
    async () => {
      const routes = await proxyRoutes({
        DEV_AGENT_URL: 'http://127.0.0.1:8095',
        DEV_AGENT_SESSION_TOKEN: 'test-session-token'
      })

      expect(routes.agentWs).toBe(true)
      expect(routes.order.indexOf('/api/agent')).toBeLessThan(
        routes.order.indexOf('/api/agent/events')
      )
    }
  )
})
