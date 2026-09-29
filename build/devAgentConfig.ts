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
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              ...(comfyToken ? { 'X-Comfy-Token': comfyToken } : {})
            }
          }
        : undefined
  }
}
