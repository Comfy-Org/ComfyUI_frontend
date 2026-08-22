import { spawnSync } from 'node:child_process'
import type { AgentCliAdapter } from '../checks/agentCli'

const TIMEOUT_MS = 180_000

interface SpawnResult {
  status: number | null
  signal: NodeJS.Signals | null
  stderr?: string
  error?: NodeJS.ErrnoException
}
type Spawner = (
  command: string,
  args: string[],
  cwd: string,
  timeout: number
) => SpawnResult

interface RefactorOptions {
  adapter: AgentCliAdapter
  specPath: string
  projectRoot: string
  /** Injectable for tests; defaults to a real spawnSync-backed runner. */
  spawn?: Spawner
}

interface RefactorResult {
  ran: boolean
  timedOut?: boolean
  error?: string
}

const realSpawn: Spawner = (command, args, cwd, timeout) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout
  })
  return {
    status: result.error ? null : result.status,
    signal: result.signal,
    stderr: result.stderr?.toString(),
    error: result.error
  }
}

function buildPrompt(specPath: string): string {
  return [
    `Refactor exactly one file, ${specPath}, to match this repo's`,
    'Playwright E2E conventions. Do not touch any other file.',
    '',
    'Read these first and apply what they say:',
    '- docs/guidance/playwright.md',
    '- browser_tests/README.md',
    '- browser_tests/AGENTS.md',
    '- browser_tests/FLAKE_PREVENTION_RULES.md',
    '',
    'Keep the test behaviorally identical — same actions, same assertions,',
    'same intent. Only change naming, structure, and style to match',
    'convention (fixture usage, locator style, avoiding waitForTimeout,',
    'node references over pixel coordinates, etc).',
    '',
    'If the file already follows convention, make no changes.'
  ].join('\n')
}

/**
 * Hands the recorded spec to a local coding-agent CLI for a one-shot
 * convention pass. The caller is responsible for getting the user's consent
 * first — this never runs silently.
 */
export function runAgentRefactor(options: RefactorOptions): RefactorResult {
  const { adapter, specPath, projectRoot, spawn = realSpawn } = options
  const prompt = buildPrompt(specPath)
  const args = adapter.buildArgs(prompt)

  const result = spawn(adapter.command, args, projectRoot, TIMEOUT_MS)

  // spawnSync's own timeout kills the process with SIGTERM AND sets
  // error.code to ETIMEDOUT — that pair is the only reliable timeout
  // signature. A bare SIGTERM (the process killed independently, e.g. by
  // the user or the OS) is a process failure, not a timeout.
  if (result.error) {
    const timedOut = result.error.code === 'ETIMEDOUT'
    return timedOut
      ? { ran: false, timedOut: true }
      : { ran: false, error: result.error.message }
  }
  if (result.status !== 0) {
    return { ran: false, error: result.stderr?.trim() }
  }
  return { ran: true }
}
