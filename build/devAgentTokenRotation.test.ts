// node:http rather than fetch: vitest.network.setup.ts blocks fetch to http(s).
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { Server } from 'node:http'
import { createServer, request } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createServer as createViteServer } from 'vite'
import type { ViteDevServer } from 'vite'

import { createDevAgentConfig } from './devAgentConfig.ts'

function listeningPort(server: Pick<Server, 'address'> | null): number {
  const address = server?.address()
  if (!address || typeof address === 'string') {
    throw new Error('expected a server listening on a TCP port')
  }
  return address.port
}

class FakeStandaloneAgent {
  private token = randomBytes(32).toString('hex')
  private readonly server: Server
  readonly requestAuthorizations: Array<string | undefined> = []
  readonly upgradeAuthorizations: Array<string | undefined> = []
  private constructor() {
    this.server = createServer((req, res) => {
      this.requestAuthorizations.push(req.headers.authorization)
      if (!this.authorized(req.headers.authorization)) {
        res.statusCode = 401
        res.end('unauthorized')
        return
      }
      res.statusCode = 200
      res.end(JSON.stringify({ path: req.url }))
    })
    this.server.on('upgrade', (req, socket) => {
      this.upgradeAuthorizations.push(req.headers.authorization)
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
    return `http://127.0.0.1:${listeningPort(this.server)}`
  }

  get currentToken(): string {
    return this.token
  }

  restart(): void {
    this.token = randomBytes(32).toString('hex')
  }

  async publishDiscovery(dataDir: string): Promise<void> {
    await writeFile(
      join(dataDir, 'agent.json'),
      JSON.stringify({
        port: listeningPort(this.server),
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
  return `http://127.0.0.1:${listeningPort(server.httpServer)}`
}

async function getThroughProxy(
  server: ViteDevServer,
  path: string,
  headers: Record<string, string> = {}
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

async function upgradeThroughProxy(server: ViteDevServer): Promise<number> {
  const origin = devServerUrl(server)
  return new Promise((done, fail) => {
    const req = request(`${devServerUrl(server)}/api/agent/events`, {
      headers: {
        Connection: 'Upgrade',
        Origin: origin,
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

async function rejectCrossOriginUpgrade(server: ViteDevServer): Promise<void> {
  await new Promise<void>((done, fail) => {
    const req = request(`${devServerUrl(server)}/api/agent/events`, {
      headers: {
        Connection: 'Upgrade',
        Origin: 'http://evil.example.com',
        'Sec-Fetch-Site': 'cross-site',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13'
      }
    })
    req.on('upgrade', (_res, socket) => {
      socket.destroy()
      fail(new Error('cross-origin upgrade was accepted'))
    })
    req.on('response', (res) => {
      res.resume()
      res.on('end', done)
    })
    req.on('error', done)
    req.end()
  })
  // Barrier: reaches the agent after any forwarded rejected upgrade.
  await upgradeThroughProxy(server)
}

describe('dev agent proxy across an agent restart', { timeout: 15_000 }, () => {
  const started: { agent?: FakeStandaloneAgent; server?: ViteDevServer } = {}
  let ownedDataDir: string | undefined

  afterEach(async () => {
    await started.server?.close()
    await started.agent?.stop()
    started.server = undefined
    started.agent = undefined
    if (ownedDataDir) await rm(ownedDataDir, { force: true, recursive: true })
    ownedDataDir = undefined
  })

  async function bringUpPair(mode: 'discovery' | 'static'): Promise<{
    agent: FakeStandaloneAgent
    server: ViteDevServer
    dataDir: string
  }> {
    const agent = await FakeStandaloneAgent.start()
    started.agent = agent
    const pairDataDir = await mkdtemp(join(tmpdir(), 'dev-agent-rotation-'))
    ownedDataDir = pairDataDir
    await agent.publishDiscovery(pairDataDir)
    const server = await startDevServer(
      mode === 'discovery'
        ? { DEV_AGENT_URL: agent.url, DEV_AGENT_DATA_DIR: pairDataDir }
        : {
            DEV_AGENT_URL: agent.url,
            DEV_AGENT_SESSION_TOKEN: agent.currentToken
          },
      resolve(import.meta.dirname, '..')
    )
    started.server = server
    return { agent, server, dataDir: pairDataDir }
  }

  it('reaches the restarted agent without restarting the dev server', async () => {
    const { agent, server, dataDir } = await bringUpPair('discovery')
    expect(await getThroughProxy(server, '/api/agent/threads')).toBe(200)
    expect(await upgradeThroughProxy(server)).toBe(101)

    agent.restart()
    await agent.publishDiscovery(dataDir)

    expect(await getThroughProxy(server, '/api/agent/threads')).toBe(200)
    expect(await upgradeThroughProxy(server)).toBe(101)
  })

  it('does not forward an inbound credential while discovery is unavailable', async () => {
    const agent = await FakeStandaloneAgent.start()
    started.agent = agent
    ownedDataDir = await mkdtemp(join(tmpdir(), 'dev-agent-rotation-'))
    const server = await startDevServer(
      { DEV_AGENT_URL: agent.url, DEV_AGENT_DATA_DIR: ownedDataDir },
      resolve(import.meta.dirname, '..')
    )
    started.server = server

    expect(
      await getThroughProxy(server, '/api/agent/threads', {
        Authorization: `Bearer ${agent.currentToken}`,
        'Sec-Fetch-Site': 'same-origin'
      })
    ).toBe(401)
    expect(agent.requestAuthorizations).toEqual([undefined])
  })

  it('keeps the credential off cross-origin requests after a rotation', async () => {
    const { agent, server, dataDir } = await bringUpPair('discovery')
    agent.restart()
    await agent.publishDiscovery(dataDir)

    expect(
      await getThroughProxy(server, '/api/agent/threads', {
        origin: 'http://evil.example.com'
      })
    ).toBe(403)

    await rejectCrossOriginUpgrade(server)
    expect(agent.upgradeAuthorizations).toEqual([
      `Bearer ${agent.currentToken}`
    ])
  })

  it('keeps a static credential off a cross-origin upgrade', async () => {
    const { agent, server } = await bringUpPair('static')

    await rejectCrossOriginUpgrade(server)
    expect(agent.upgradeAuthorizations).toEqual([
      `Bearer ${agent.currentToken}`
    ])
  })

  it('rejects a request that declares itself cross-site', async () => {
    const { agent, server } = await bringUpPair('discovery')

    expect(
      await getThroughProxy(server, '/api/agent/threads', {
        'Sec-Fetch-Site': 'cross-site'
      })
    ).toBe(403)
    expect(
      await getThroughProxy(server, '/api/agent/threads', {
        'Sec-Fetch-Site': 'same-site'
      })
    ).toBe(403)
    expect(
      await getThroughProxy(server, '/api/agent/threads', {
        origin: devServerUrl(server),
        'Sec-Fetch-Site': 'cross-site'
      })
    ).toBe(403)
    expect(agent.requestAuthorizations).toEqual([])
  })

  it('serves a caller that sends no browser metadata at all', async () => {
    const { server } = await bringUpPair('discovery')

    expect(await getThroughProxy(server, '/api/agent/threads', {})).toBe(200)
    expect(
      await getThroughProxy(server, '/api/agent/threads', {
        'Sec-Fetch-Site': 'same-origin'
      })
    ).toBe(200)
    expect(
      await getThroughProxy(server, '/api/agent/threads', {
        'Sec-Fetch-Site': 'none'
      })
    ).toBe(200)
  })
})
