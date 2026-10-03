// Black-box proof for PM-1927: restarting the standalone agent rotates its
// session token, and the dev server must follow that rotation without being
// restarted itself — the browser tab and ComfyUI stay up throughout.
//
// Nothing here is mocked. A real Vite dev server proxies to a real HTTP server
// that enforces a bearer token the way the agent's LocalAuth does, and the
// "restart" is the agent process's own two observable side effects: it begins
// accepting a new token, and it replaces agent.json with it.
//
// The requests use node:http rather than fetch because the tooling project
// blocks fetch to http(s) (vitest.network.setup.ts); these are loopback
// requests to servers this file owns and starts.
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import { createServer, request } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createServer as createViteServer } from 'vite'
import type { ViteDevServer } from 'vite'

import { createDevAgentConfig } from './devAgentConfig.ts'

/**
 * Stand-in for the standalone agent's authenticated loopback surface: a 200 on
 * the token it is currently accepting, a bare 401 on anything else (including
 * on the /agent/events upgrade, which LocalAuth gates with the same token).
 * `restart()` is the whole of PM-1927's mechanism — mint a new token, keep the
 * port.
 */
class FakeStandaloneAgent {
  private token = randomBytes(32).toString('hex')
  private readonly server: Server
  private constructor() {
    this.server = createServer((req, res) => {
      if (!this.authorized(req.headers.authorization)) {
        res.statusCode = 401
        res.end('unauthorized')
        return
      }
      res.statusCode = 200
      res.end(JSON.stringify({ path: req.url }))
    })
    this.server.on('upgrade', (req, socket) => {
      socket.end(
        this.authorized(req.headers.authorization)
          ? 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n'
          : 'HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'
      )
    })
  }

  static async start(): Promise<FakeStandaloneAgent> {
    const agent = new FakeStandaloneAgent()
    await new Promise<void>((done) =>
      agent.server.listen(0, '127.0.0.1', () => done())
    )
    return agent
  }

  private authorized(header: string | undefined): boolean {
    return header === `Bearer ${this.token}`
  }

  get url(): string {
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`
  }

  /** The token this agent published when it last started. */
  get currentToken(): string {
    return this.token
  }

  /** What a restart does: a fresh token on the same port. */
  restart(): void {
    this.token = randomBytes(32).toString('hex')
  }

  /** What the agent writes into <data-dir>/agent.json on every start. */
  async publishDiscovery(dataDir: string): Promise<void> {
    await writeFile(
      join(dataDir, 'agent.json'),
      JSON.stringify({
        port: (this.server.address() as AddressInfo).port,
        token: this.token,
        pid: process.pid
      }),
      { mode: 0o600 }
    )
  }

  async stop(): Promise<void> {
    await new Promise<void>((done) => this.server.close(() => done()))
  }
}

async function startDevServer(
  env: NodeJS.ProcessEnv,
  root: string
): Promise<ViteDevServer> {
  const { proxy } = createDevAgentConfig(env)
  if (!proxy) throw new Error('expected the agent proxy to be configured')
  const server = await createViteServer({
    configFile: false,
    root,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, proxy: { '/api/agent': proxy } }
  })
  await server.listen()
  return server
}

function devServerUrl(server: ViteDevServer): string {
  const address = server.httpServer?.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

/** One same-origin REST call the panel makes, through the dev server. */
async function getThroughProxy(
  server: ViteDevServer,
  path: string,
  headers: Record<string, string> = { 'Sec-Fetch-Site': 'same-origin' }
): Promise<number> {
  return new Promise((done, fail) => {
    const req = request(
      `${devServerUrl(server)}${path}`,
      { headers },
      (res) => {
        res.resume()
        res.on('end', () => done(res.statusCode ?? 0))
      }
    )
    req.on('error', fail)
    req.end()
  })
}

/** The /api/agent/events upgrade the panel's event source opens. */
async function upgradeThroughProxy(server: ViteDevServer): Promise<number> {
  const origin = devServerUrl(server)
  return new Promise((done, fail) => {
    const req = request(`${devServerUrl(server)}/api/agent/events`, {
      headers: {
        Connection: 'Upgrade',
        Origin: origin,
        'Sec-Fetch-Site': 'same-origin',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13'
      }
    })
    req.on('upgrade', (_res, socket) => {
      socket.destroy()
      done(101)
    })
    req.on('response', (res) => {
      res.resume()
      res.on('end', () => done(res.statusCode ?? 0))
    })
    req.on('error', fail)
    req.end()
  })
}

describe('dev agent proxy across an agent restart', () => {
  const started: { agent?: FakeStandaloneAgent; server?: ViteDevServer } = {}
  let dataDir: string | undefined

  afterEach(async () => {
    await started.server?.close()
    await started.agent?.stop()
    started.server = undefined
    started.agent = undefined
    if (dataDir) await rm(dataDir, { force: true, recursive: true })
    dataDir = undefined
  })

  async function bringUpPair(
    mode: 'discovery' | 'static'
  ): Promise<{ agent: FakeStandaloneAgent; server: ViteDevServer }> {
    const agent = await FakeStandaloneAgent.start()
    started.agent = agent
    dataDir = await mkdtemp(join(tmpdir(), 'dev-agent-rotation-'))
    await agent.publishDiscovery(dataDir)
    const server = await startDevServer(
      mode === 'discovery'
        ? { DEV_AGENT_URL: agent.url, DEV_AGENT_DATA_DIR: dataDir }
        : // What a hand-started stack does: read the token out of agent.json
          // once and hand that value to the dev server.
          {
            DEV_AGENT_URL: agent.url,
            DEV_AGENT_SESSION_TOKEN: agent.currentToken
          },
      resolve(import.meta.dirname, '..')
    )
    started.server = server
    return { agent, server }
  }

  it(
    'reaches the restarted agent without restarting the dev server',
    { timeout: 60_000 },
    async () => {
      const { agent, server } = await bringUpPair('discovery')
      expect(await getThroughProxy(server, '/api/agent/threads')).toBe(200)
      expect(await upgradeThroughProxy(server)).toBe(101)

      agent.restart()
      await agent.publishDiscovery(dataDir!)

      // Same dev server, same client: no Vite restart, no page reload, no
      // ComfyUI restart. This is the assertion PM-1927 is about.
      expect(await getThroughProxy(server, '/api/agent/threads')).toBe(200)
      expect(await upgradeThroughProxy(server)).toBe(101)
    }
  )

  it(
    'is the behaviour a token captured at dev-server start cannot provide',
    { timeout: 60_000 },
    async () => {
      const { agent, server } = await bringUpPair('static')
      expect(await getThroughProxy(server, '/api/agent/threads')).toBe(200)

      agent.restart()
      await agent.publishDiscovery(dataDir!)

      // The failure PM-1927 reported: permanent 401 on every agent route and
      // on the event stream, with the agent itself healthy and reachable.
      expect(await getThroughProxy(server, '/api/agent/threads')).toBe(401)
      expect(await upgradeThroughProxy(server)).toBe(401)
    }
  )

  it(
    'heals once the agent publishes, having started after the dev server',
    { timeout: 60_000 },
    async () => {
      const agent = await FakeStandaloneAgent.start()
      started.agent = agent
      dataDir = await mkdtemp(join(tmpdir(), 'dev-agent-rotation-'))
      const server = await startDevServer(
        { DEV_AGENT_URL: agent.url, DEV_AGENT_DATA_DIR: dataDir },
        resolve(import.meta.dirname, '..')
      )
      started.server = server

      // No agent.json yet: unauthenticated, so LocalAuth's 401 stands.
      expect(await getThroughProxy(server, '/api/agent/threads')).toBe(401)

      await agent.publishDiscovery(dataDir)
      expect(await getThroughProxy(server, '/api/agent/threads')).toBe(200)
    }
  )

  it(
    'keeps the credential off cross-origin requests after a rotation',
    { timeout: 60_000 },
    async () => {
      const { agent, server } = await bringUpPair('discovery')
      agent.restart()
      await agent.publishDiscovery(dataDir!)

      const status = await new Promise<number>((done, fail) => {
        const req = request(
          `${devServerUrl(server)}/api/agent/threads`,
          { headers: { origin: 'http://evil.example.com' } },
          (res) => {
            res.resume()
            res.on('end', () => done(res.statusCode ?? 0))
          }
        )
        req.on('error', fail)
        req.end()
      })
      expect(status).toBe(403)
    }
  )

  it(
    'rejects requests without same-origin browser metadata',
    { timeout: 60_000 },
    async () => {
      const { server } = await bringUpPair('discovery')

      expect(await getThroughProxy(server, '/api/agent/threads', {})).toBe(403)
      expect(
        await getThroughProxy(server, '/api/agent/threads', {
          origin: devServerUrl(server),
          'Sec-Fetch-Site': 'cross-site'
        })
      ).toBe(403)
    }
  )
})
