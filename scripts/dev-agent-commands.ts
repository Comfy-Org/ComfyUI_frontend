import type { Options } from './dev-agent-options'

export function smokeCommand(frontendUrl: string): string {
  return `PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=${frontendUrl} pnpm exec playwright test agentHarnessSmoke --project=agent-harness`
}

export function standaloneEnv(
  options: Options,
  dataDir: string,
  token: string,
  inherited: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const env = { ...inherited }
  for (const key of [
    'AGENT_CRDT_MODE',
    'AGENT_M2M_SECRET',
    'AGENT_RUNNER_ENDPOINT',
    'DB_CONNECTION_STRING',
    'DOC_HOST_ENDPOINT',
    'REDIS_URL'
  ]) {
    delete env[key]
  }
  return {
    ...env,
    AGENT_BIND_ADDR: '127.0.0.1',
    AGENT_COMFY_URL: options.comfyUrl,
    AGENT_DATA_DIR: dataDir,
    AGENT_ENGINE: 'inline',
    AGENT_SESSION_TOKEN: token,
    AGENT_STANDALONE: 'true',
    AGENT_TARGET: 'local',
    HEALTH_PORT: String(options.healthPort),
    PORT: String(options.agentPort)
  }
}
