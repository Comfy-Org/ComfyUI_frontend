import { execSync } from 'node:child_process'

export interface AgentCliAdapter {
  /** Display name, e.g. "Claude Code". */
  label: string
  /** Binary to look for on PATH. */
  command: string
  /** Builds the args for a non-interactive, single-turn run with `prompt`. */
  buildArgs: (prompt: string) => string[]
}

// Ordered by preference when more than one is installed.
export const AGENT_CLI_ADAPTERS: AgentCliAdapter[] = [
  {
    label: 'Claude Code',
    command: 'claude',
    buildArgs: (prompt) => [
      '-p',
      prompt,
      '--permission-mode',
      'acceptEdits',
      '--allowed-tools',
      'Edit,Read,Grep,Glob'
    ]
  },
  {
    label: 'Codex',
    command: 'codex',
    buildArgs: (prompt) => ['exec', '--sandbox', 'workspace-write', prompt]
  },
  {
    label: 'Gemini CLI',
    command: 'gemini',
    buildArgs: (prompt) => ['-p', prompt, '--approval-mode', 'auto_edit']
  },
  {
    label: 'Amp',
    command: 'amp',
    buildArgs: (prompt) => ['-x', prompt]
  },
  {
    label: 'opencode',
    command: 'opencode',
    buildArgs: (prompt) => ['run', prompt]
  }
]

function realCommandExists(command: string): boolean {
  try {
    execSync(
      process.platform === 'win32'
        ? `where ${command}`
        : `command -v ${command}`,
      { stdio: 'pipe' }
    )
    return true
  } catch {
    return false
  }
}

/**
 * Returns every installed adapter, in preference order.
 * `commandExists` is injectable for tests; defaults to a real PATH probe.
 */
export function detectAgentClis(
  commandExists: (command: string) => boolean = realCommandExists
): AgentCliAdapter[] {
  return AGENT_CLI_ADAPTERS.filter((adapter) => commandExists(adapter.command))
}
