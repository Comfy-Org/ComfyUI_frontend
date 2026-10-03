import { accessSync, constants, statSync } from 'node:fs'
import type { ClientRequest, IncomingMessage } from 'node:http'
import type { ProxyOptions } from 'vite'

import { readAgentDiscoveryToken } from './devAgentDiscovery.ts'

// The agent proxy adds the session token, so only the dev server's own pages may use it.
function isCrossOrigin(req: IncomingMessage): boolean {
  // `Sec-Fetch-Site` sees what `Origin` cannot: Fetch omits `Origin` on a
  // no-cors GET/HEAD, so a cross-site `<img>`, `<script>` or `<iframe src>`
  // aimed at an agent route arrives with no `Origin` at all. `none` is a
  // user-typed navigation or a bookmark, which is the dev's own request.
  //
  // An absent `Origin` still cannot be treated as cross-origin, for two
  // reasons: a *same-origin* GET omits it too — that is what the panel's own
  // reads are — and a non-browser client sends neither header, so requiring
  // either one 403s curl, Playwright's `request` fixture, and the black-box
  // suite below. A browser request that would be cross-origin always announces
  // itself through one header or the other, so rejecting on what is present
  // loses nothing.
  const fetchSite = req.headers['sec-fetch-site']
  if (
    typeof fetchSite === 'string' &&
    fetchSite !== 'same-origin' &&
    fetchSite !== 'none'
  ) {
    return true
  }
  const origin = req.headers.origin
  if (origin === undefined) return false
  try {
    return new URL(origin).host !== req.headers.host
  } catch {
    return true
  }
}

/**
 * Where the proxy gets the standalone agent's bearer token.
 *
 * `static` is a token handed to the dev server at start — what
 * `scripts/dev-agent-integration.ts` does, which is safe there because it also
 * pins the same value into the agent's `AGENT_SESSION_TOKEN`, so an Air restart
 * does not rotate it.
 *
 * `discovery` is the agent's own `agent.json`, read per request. Use it when
 * the agent is started separately and mints its own token, because then every
 * agent restart rotates the credential and a value captured once is stale.
 */
type AgentTokenSource =
  | { kind: 'static'; token: string }
  | { kind: 'discovery'; dataDir: string }

export function createDevAgentConfig(env: NodeJS.ProcessEnv) {
  const url = env.DEV_AGENT_URL
  const sessionToken = env.DEV_AGENT_SESSION_TOKEN
  const dataDir = env.DEV_AGENT_DATA_DIR
  const comfyToken = env.DEV_AGENT_COMFY_TOKEN

  if (sessionToken && dataDir) {
    throw new Error(
      'DEV_AGENT_SESSION_TOKEN and DEV_AGENT_DATA_DIR are two sources for the same credential; set exactly one.'
    )
  }

  if (Boolean(url) !== Boolean(sessionToken || dataDir)) {
    throw new Error(
      'DEV_AGENT_URL needs exactly one token source, and a token source needs DEV_AGENT_URL. ' +
        "Set DEV_AGENT_SESSION_TOKEN for a token that will not change, or DEV_AGENT_DATA_DIR to read the agent's current token from its agent.json."
    )
  }

  if (env.VITE_AGENT_STANDALONE === 'true' && !url) {
    throw new Error(
      'VITE_AGENT_STANDALONE requires DEV_AGENT_URL plus a token source; start via scripts/dev-agent-integration.ts.'
    )
  }

  if (url) {
    const { protocol, hostname } = new URL(url)
    const loopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(
      hostname
    )
    if (protocol !== 'https:' && !(protocol === 'http:' && loopback)) {
      throw new Error(
        `DEV_AGENT_URL must use https unless it targets loopback; got ${url}`
      )
    }
  }

  if (dataDir) {
    try {
      accessSync(dataDir, constants.R_OK)
      if (!statSync(dataDir).isDirectory()) throw new Error()
    } catch {
      throw new Error(
        `DEV_AGENT_DATA_DIR must be an existing readable directory; got ${dataDir}`
      )
    }
  }

  const tokenSource: AgentTokenSource | undefined = sessionToken
    ? { kind: 'static', token: sessionToken }
    : dataDir
      ? { kind: 'discovery', dataDir }
      : undefined

  return {
    host: !comfyToken && env.VITE_REMOTE_DEV === 'true' ? '0.0.0.0' : undefined,
    proxy:
      url && tokenSource
        ? createAgentProxy(url, tokenSource, comfyToken)
        : undefined
  }
}

function createAgentProxy(
  target: string,
  tokenSource: AgentTokenSource,
  comfyToken: string | undefined
): ProxyOptions {
  return {
    target,
    ws: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
    headers: {
      // A static token is a constant for the dev server's whole life, so it
      // rides on the proxy's own headers. A discovery token is re-read per
      // request in `configure` below instead.
      ...(tokenSource.kind === 'static'
        ? { Authorization: `Bearer ${tokenSource.token}` }
        : {}),
      ...(comfyToken ? { 'X-Comfy-Token': comfyToken } : {})
    },
    configure: (proxy) => {
      proxy.on('proxyReqWs', (proxyReq, req, socket) => {
        if (isCrossOrigin(req)) {
          proxyReq.destroy()
          socket.destroy()
        }
      })
      if (tokenSource.kind !== 'discovery') return

      const { dataDir } = tokenSource
      const authorize = (proxyReq: ClientRequest) => {
        proxyReq.removeHeader('Authorization')
        const token = readAgentDiscoveryToken(dataDir)
        if (token) proxyReq.setHeader('Authorization', `Bearer ${token}`)
      }
      proxy.on('proxyReq', authorize)
      proxy.on('proxyReqWs', (proxyReq, _req, socket) => {
        // The cross-origin handler above runs first and may have destroyed the
        // socket; do not put a credential on a request that is already dead.
        if (!socket.destroyed) authorize(proxyReq)
      })
    },
    bypass: (req, res) => {
      if (!res || !isCrossOrigin(req)) return null
      res.statusCode = 403
      res.end('The agent proxy serves the dev server origin only')
      return false
    }
  }
}
