import { access } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { Options } from './dev-agent-options'
import { assertReachable } from './dev-agent-supervisor'

export async function preflightAgent(
  options: Options,
  requiredFiles: string[],
  env: NodeJS.ProcessEnv = process.env
): Promise<{ agentDir: string; agentUrl: string }> {
  const agentDir = resolve(options.cloudRepo, 'services/agent')
  await Promise.all(
    requiredFiles.map((path) => access(resolve(agentDir, path)))
  )
  await assertReachable(`${options.comfyUrl.replace(/\/$/, '')}/system_stats`)
  if (!env.ANTHROPIC_API_KEY && !env.ANTHROPIC_BASE_URL) {
    throw new Error('Set ANTHROPIC_API_KEY or ANTHROPIC_BASE_URL')
  }
  return {
    agentDir,
    agentUrl: `http://127.0.0.1:${options.agentPort}`
  }
}
