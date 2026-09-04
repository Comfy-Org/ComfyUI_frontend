import { runCommand } from '../cli/run'

export interface AgentReplayOptions {
  caseId?: string
  url?: string
  headed?: boolean
  video?: boolean
}

export interface AgentReplayInvocation {
  args: string[]
  env: Record<string, string>
}

const DEFAULT_URL = 'http://localhost:5173'

// The replay suite is every spec matching agentConversation under browser_tests/tests/agent.
export function agentReplayInvocation(
  options: AgentReplayOptions
): AgentReplayInvocation {
  const args = [
    'exec',
    'playwright',
    'test',
    'agentConversation',
    '--project=cloud'
  ]
  if (options.caseId) args.push('-g', options.caseId)
  if (options.headed) args.push('--headed')
  const env: Record<string, string> = {
    PLAYWRIGHT_LOCAL: '1',
    PLAYWRIGHT_TEST_URL: options.url ?? DEFAULT_URL,
    DISTRIBUTION: 'cloud'
  }
  if (options.video) env.RECORD_VIDEO = 'true'
  return { args, env }
}

export function runAgentReplay(options: AgentReplayOptions): number {
  const { args, env } = agentReplayInvocation(options)
  const result = runCommand('pnpm', args, {
    stdio: 'inherit',
    env: { ...process.env, ...env }
  })
  return result.status ?? 1
}
