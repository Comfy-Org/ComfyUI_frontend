// @vitest-environment node
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)

// Written straight to the stream because the config's import graph decorates
// console output.
const PRINT_API_PROXY_HEADERS = `import('./vite.config.mts').then(({ default: config }) => {
  process.stdout.write(
    '<headers>' +
      JSON.stringify(config.server.proxy['/api'].headers ?? null) +
      '</headers>'
  )
})`

const PRINT_API_PROXY_SECURE = `import('./vite.config.mts').then(({ default: config }) => {
  process.stdout.write('<secure>' + String(config.server.proxy['/api'].secure) + '</secure>')
})`

async function apiProxyHeaders(
  serviceToken: Record<string, string>
): Promise<Record<string, string> | null> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--import', 'tsx', '--eval', PRINT_API_PROXY_HEADERS],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_REMOTE_DEV: 'false',
        DEV_SERVER_COMFYUI_URL: 'https://nightly.example.com/',
        DEV_SERVER_CF_ACCESS_CLIENT_ID: '',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: '',
        ...serviceToken
      }
    }
  )
  const printed = /<headers>(.*)<\/headers>/s.exec(stdout)
  if (!printed) throw new Error(`Config printed no headers: ${stdout}`)
  return JSON.parse(printed[1])
}

// Exercises the real `configure` hook Vite would install, driving it with a
// hostile, a same-origin and an origin-less upgrade so the assertion is on
// observable socket behavior rather than on the config's shape.
const PRINT_WS_UPGRADE_VERDICTS = `import('./vite.config.mts').then(({ default: config }) => {
  const ws = config.server.proxy['/ws']
  const handlers = {}
  ws.configure?.({ on: (event, handler) => { handlers[event] = handler } }, ws)
  const upgrade = (origin) => {
    let destroyed = false
    handlers.proxyReqWs?.(
      {},
      { headers: { host: 'localhost:5173', origin } },
      { destroy: () => { destroyed = true } }
    )
    return destroyed
  }
  process.stdout.write(
    '<verdicts>' +
      JSON.stringify({
        guarded: typeof ws.configure === 'function',
        hostileRejected: upgrade('http://evil.example.com'),
        sameOriginRejected: upgrade('http://localhost:5173'),
        originlessRejected: upgrade(undefined)
      }) +
      '</verdicts>'
  )
})`

interface WsUpgradeVerdicts {
  guarded: boolean
  hostileRejected: boolean
  sameOriginRejected: boolean
  originlessRejected: boolean
}

async function wsUpgradeVerdicts(
  serviceToken: Record<string, string>
): Promise<WsUpgradeVerdicts> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--import', 'tsx', '--eval', PRINT_WS_UPGRADE_VERDICTS],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_REMOTE_DEV: 'false',
        DEV_SERVER_COMFYUI_URL: 'https://nightly.example.com/',
        DEV_SERVER_CF_ACCESS_CLIENT_ID: '',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: '',
        ...serviceToken
      }
    }
  )
  const printed = /<verdicts>(.*)<\/verdicts>/s.exec(stdout)
  if (!printed) throw new Error(`Config printed no verdicts: ${stdout}`)
  return JSON.parse(printed[1]) as WsUpgradeVerdicts
}

// Drives the real `bypass` hook Vite would call on each token-bearing HTTP
// route, so the assertion is on what a caller observes rather than on the
// config's shape. A foreign page cannot read these responses, but the request
// still reaches the gated backend with the service token attached.
const PRINT_HTTP_BYPASS_VERDICTS = `import('./vite.config.mts').then(({ default: config }) => {
  const call = (route, headers, url) => {
    const bypass = config.server.proxy[route].bypass
    if (typeof bypass !== 'function') return { guarded: false }
    let status
    let body
    const res = {
      statusCode: 200,
      setHeader() {},
      end(written) { status = this.statusCode; body = written }
    }
    const result = bypass({ url: url ?? route, method: 'POST', headers }, res, {})
    return { guarded: true, rejected: result === false, status, body: String(body) }
  }
  const hostile = { host: 'localhost:5173', origin: 'http://localhost:5174' }
  const sameOrigin = { host: 'localhost:5173', origin: 'http://localhost:5173' }
  const crossSiteGet = { host: 'localhost:5173', 'sec-fetch-site': 'same-site' }
  const sameOriginGet = { host: 'localhost:5173', 'sec-fetch-site': 'same-origin' }
  const nonBrowser = { host: 'localhost:5173' }
  const wsBypass = config.server.proxy['/ws'].bypass
  process.stdout.write(
    '<http>' +
      JSON.stringify({
        internalGuarded: call('/internal', hostile).guarded,
        internalHostileStatus: call('/internal', hostile).status ?? null,
        internalSameOriginRejected: call('/internal', sameOrigin).rejected,
        internalCrossSiteGetRejected: call('/internal', crossSiteGet).rejected,
        internalSameOriginGetRejected: call('/internal', sameOriginGet).rejected,
        internalNonBrowserRejected: call('/internal', nonBrowser).rejected,
        apiHostileRejected: call('/api', hostile).rejected,
        apiExtensionsBody: call('/api', sameOrigin, '/api/extensions').body,
        oauthHostileRejected: call('/oauth', hostile).rejected,
        oauthConsentRewritten:
          config.server.proxy['/oauth'].bypass(
            { url: '/oauth/consent', method: 'GET', headers: sameOrigin },
            { statusCode: 200, setHeader() {}, end() {} },
            {}
          ) === '/oauth/consent',
        wsUpgradeUntouched:
          typeof wsBypass !== 'function' ||
          wsBypass({ url: '/ws', method: 'GET', headers: hostile }, undefined, {}) === null
      }) +
      '</http>'
  )
})`

async function httpBypassVerdicts(
  serviceToken: Record<string, string>
): Promise<Record<string, unknown>> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--import', 'tsx', '--eval', PRINT_HTTP_BYPASS_VERDICTS],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_REMOTE_DEV: 'false',
        DEV_SERVER_COMFYUI_URL: 'https://nightly.example.com/',
        DEV_SERVER_CF_ACCESS_CLIENT_ID: '',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: '',
        ...serviceToken
      }
    }
  )
  const printed = /<http>(.*)<\/http>/s.exec(stdout)
  if (!printed) throw new Error(`Config printed no verdicts: ${stdout}`)
  return JSON.parse(printed[1]) as Record<string, unknown>
}

async function apiProxySecure(
  serviceToken: Record<string, string>
): Promise<boolean> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--import', 'tsx', '--eval', PRINT_API_PROXY_SECURE],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_REMOTE_DEV: 'false',
        DEV_SERVER_COMFYUI_URL: 'https://nightly.example.com/',
        DISTRIBUTION: 'cloud',
        DEV_SERVER_CF_ACCESS_CLIENT_ID: '',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: '',
        ...serviceToken
      }
    }
  )
  const printed = /<secure>(.*)<\/secure>/s.exec(stdout)
  if (!printed) throw new Error(`Config printed no secure value: ${stdout}`)
  return printed[1] === 'true'
}

describe('Cloudflare Access service token on the backend proxy', () => {
  it('forwards a configured service token to the backend', async () => {
    await expect(
      apiProxyHeaders({
        DEV_SERVER_CF_ACCESS_CLIENT_ID: 'client-id.access',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: 'client-secret'
      })
    ).resolves.toEqual({
      'CF-Access-Client-Id': 'client-id.access',
      'CF-Access-Client-Secret': 'client-secret'
    })
  }, 60_000)

  it('sends no headers when no service token is configured', async () => {
    await expect(apiProxyHeaders({})).resolves.toBeNull()
  }, 60_000)

  it('refuses to expose an authenticated proxy through remote development', async () => {
    await expect(
      apiProxyHeaders({
        DEV_SERVER_CF_ACCESS_CLIENT_ID: 'client-id.access',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: 'client-secret',
        VITE_REMOTE_DEV: 'true'
      })
    ).rejects.toThrow('cannot be used with VITE_REMOTE_DEV')
  }, 60_000)

  it('verifies backend TLS when forwarding a service token', async () => {
    await expect(
      apiProxySecure({
        DEV_SERVER_CF_ACCESS_CLIENT_ID: 'client-id.access',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: 'client-secret'
      })
    ).resolves.toBe(true)
  }, 60_000)

  it('destroys a cross-origin /ws upgrade before the token reaches the backend', async () => {
    await expect(
      wsUpgradeVerdicts({
        DEV_SERVER_CF_ACCESS_CLIENT_ID: 'client-id.access',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: 'client-secret'
      })
    ).resolves.toEqual({
      guarded: true,
      hostileRejected: true,
      sameOriginRejected: false,
      originlessRejected: false
    })
  }, 60_000)

  it('leaves the /ws proxy unguarded when no service token is configured', async () => {
    await expect(wsUpgradeVerdicts({})).resolves.toMatchObject({
      guarded: false
    })
  }, 60_000)

  it('refuses a foreign caller on every token-bearing HTTP route', async () => {
    await expect(
      httpBypassVerdicts({
        DEV_SERVER_CF_ACCESS_CLIENT_ID: 'client-id.access',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: 'client-secret'
      })
    ).resolves.toMatchObject({
      internalGuarded: true,
      internalHostileStatus: 403,
      internalCrossSiteGetRejected: true,
      apiHostileRejected: true,
      oauthHostileRejected: true
    })
  }, 60_000)

  it('serves the dev server its own pages while the token is attached', async () => {
    await expect(
      httpBypassVerdicts({
        DEV_SERVER_CF_ACCESS_CLIENT_ID: 'client-id.access',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: 'client-secret'
      })
    ).resolves.toMatchObject({
      internalSameOriginRejected: false,
      internalSameOriginGetRejected: false,
      internalNonBrowserRejected: false,
      apiExtensionsBody: '[]',
      oauthConsentRewritten: true,
      wsUpgradeUntouched: true
    })
  }, 60_000)

  it('leaves the HTTP routes unguarded when no service token is configured', async () => {
    await expect(httpBypassVerdicts({})).resolves.toMatchObject({
      internalGuarded: false,
      apiHostileRejected: false,
      oauthHostileRejected: false,
      apiExtensionsBody: '[]',
      oauthConsentRewritten: true
    })
  }, 60_000)
})
