import { accessSync, constants, statSync } from 'node:fs'
import type { ClientRequest, IncomingMessage } from 'node:http'
import type { ProxyOptions } from 'vite'

import { readAgentDiscoveryToken } from './devAgentDiscovery.ts'

// The agent proxy adds the session token, so only the dev server's own pages may use it.
function isCrossOrigin(req: IncomingMessage): boolean {
  // Fetch omits `Origin` on no-cors GETs, which `Sec-Fetch-Site` still flags.
  // Neither header means a same-origin GET or a non-browser client.
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

function isReadableDirectory(path: string): boolean {
  try {
    accessSync(path, constants.R_OK | constants.X_OK)
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

const AGENT_SESSION_HEADER = 'X-Comfy-Agent-Session'

type AgentTokenSource =
  | { kind: 'static'; token: string }
  | { kind: 'discovery'; dataDir: string }

export function createDevAgentConfig(
  env: NodeJS.ProcessEnv,
  distribution?: 'desktop' | 'localhost' | 'cloud'
) {
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

  if (env.VITE_AGENT_STANDALONE === 'true' && distribution === 'cloud') {
    throw new Error(
      'VITE_AGENT_STANDALONE cannot be combined with DISTRIBUTION=cloud (set directly or derived from a *.comfy.org DEV_SERVER_COMFYUI_URL); unset DISTRIBUTION and point DEV_SERVER_COMFYUI_URL at a local ComfyUI.'
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

  if (dataDir && !isReadableDirectory(dataDir)) {
    throw new Error(
      `DEV_AGENT_DATA_DIR must be an existing readable directory; got ${dataDir}`
    )
  }

  const tokenSource: AgentTokenSource | undefined = sessionToken
    ? { kind: 'static', token: sessionToken }
    : dataDir
      ? { kind: 'discovery', dataDir }
      : undefined

  const proxy =
    url && tokenSource
      ? createAgentProxy(url, tokenSource, comfyToken)
      : undefined
  return {
    host: !comfyToken && env.VITE_REMOTE_DEV === 'true' ? '0.0.0.0' : undefined,
    proxy,
    proxySuppliesCredential: proxy !== undefined && Boolean(comfyToken)
  }
}

function comfyCredentialHeaders(
  comfyToken: string | undefined
): Record<string, string> {
  if (!comfyToken) return {}
  return comfyToken.startsWith('comfyui-')
    ? { 'X-API-KEY': comfyToken }
    : { Authorization: `Bearer ${comfyToken}` }
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
      ...(tokenSource.kind === 'static'
        ? { [AGENT_SESSION_HEADER]: tokenSource.token }
        : {}),
      ...comfyCredentialHeaders(comfyToken)
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
      function authorize(proxyReq: ClientRequest) {
        proxyReq.removeHeader(AGENT_SESSION_HEADER)
        const token = readAgentDiscoveryToken(dataDir)
        if (token) proxyReq.setHeader(AGENT_SESSION_HEADER, token)
      }
      proxy.on('proxyReq', authorize)
      proxy.on('proxyReqWs', authorize)
    },
    bypass: (req, res) => {
      if (!res || !isCrossOrigin(req)) return null
      res.statusCode = 403
      res.end('The agent proxy serves the dev server origin only')
      return false
    }
  }
}

export function devServerAgentRoutes(
  agentProxy: ProxyOptions | undefined,
  eventsSocketProxy: ProxyOptions
): Record<string, ProxyOptions> {
  return {
    ...(agentProxy
      ? { '/api/workflows': agentProxy, '/api/agent': agentProxy }
      : {}),
    '/api/agent/events': { ...eventsSocketProxy, ws: true }
  }
}
