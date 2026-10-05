export function createDevAgentConfig(env: NodeJS.ProcessEnv) {
  const url = env.DEV_AGENT_URL
  const sessionToken = env.DEV_AGENT_SESSION_TOKEN
  const comfyToken = env.DEV_AGENT_COMFY_TOKEN

  if (Boolean(url) !== Boolean(sessionToken)) {
    throw new Error(
      'DEV_AGENT_URL and DEV_AGENT_SESSION_TOKEN must be configured together.'
    )
  }

  if (env.VITE_AGENT_STANDALONE === 'true' && !url) {
    throw new Error(
      'VITE_AGENT_STANDALONE requires DEV_AGENT_URL and DEV_AGENT_SESSION_TOKEN; start via scripts/dev-agent-integration.ts.'
    )
  }

  // VITE_AGENT_STANDALONE forces the agent panel on for every user of the
  // bundle it is baked into (src/extensions/core/agentPanel.ts), independent
  // of the distribution. The standalone harness is never a cloud distribution,
  // so a cloud bundle carrying the flag could only be a misconfigured build
  // about to ship the panel to everyone; refuse it here rather than at runtime.
  if (env.VITE_AGENT_STANDALONE === 'true' && env.DISTRIBUTION === 'cloud') {
    throw new Error(
      'VITE_AGENT_STANDALONE cannot be combined with DISTRIBUTION=cloud: the standalone agent harness is never a cloud distribution.'
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

  return {
    host: !comfyToken && env.VITE_REMOTE_DEV === 'true' ? '0.0.0.0' : undefined,
    proxy:
      url && sessionToken
        ? {
            target: url,
            headers: devAgentProxyHeaders(sessionToken, comfyToken)
          }
        : undefined
  }
}

/**
 * What the dev server adds to every request it proxies to the local agent: the
 * agent's own session token on its dedicated header, and (only when a
 * developer supplies one) a Comfy credential presented the way ingest reads it,
 * an API key as X-API-KEY and anything else as a bearer token. Without one, the
 * browser's own signed-in auth header passes through untouched.
 */
function devAgentProxyHeaders(
  sessionToken: string,
  comfyToken: string | undefined
): Record<string, string> {
  if (!comfyToken) return { 'X-Comfy-Agent-Session': sessionToken }
  return {
    'X-Comfy-Agent-Session': sessionToken,
    ...(comfyToken.startsWith('comfyui-')
      ? { 'X-API-KEY': comfyToken }
      : { Authorization: `Bearer ${comfyToken}` })
  }
}
