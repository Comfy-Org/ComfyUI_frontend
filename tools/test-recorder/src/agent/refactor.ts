import { spawn as nodeSpawn } from 'node:child_process'
import type { AgentCliAdapter } from '../checks/agentCli'

// Agent CLIs routinely take several minutes on a convention pass — the old
// 3-minute budget produced spurious timeouts on real recordings.
const TIMEOUT_MS = 600_000
const PROGRESS_INTERVAL_MS = 5_000

const SUMMARY_START = '===CHANGES==='
const SUMMARY_END = '===END CHANGES==='

interface SpawnResult {
  status: number | null
  signal: NodeJS.Signals | null
  stdout?: string
  stderr?: string
  error?: NodeJS.ErrnoException
}
type Spawner = (
  command: string,
  args: string[],
  cwd: string,
  timeout: number
) => Promise<SpawnResult>

interface RefactorOptions {
  adapter: AgentCliAdapter
  specPath: string
  projectRoot: string
  /** Called every few seconds while the agent works, with elapsed ms. */
  onProgress?: (elapsedMs: number) => void
  /** Injectable for tests; defaults to a real spawn-backed runner. */
  spawn?: Spawner
}

interface RefactorResult {
  ran: boolean
  timedOut?: boolean
  error?: string
  /** Plain-language description of what the agent changed, when it gave one. */
  summary?: string
}

function realSpawn(
  command: string,
  args: string[],
  cwd: string,
  timeout: number
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = nodeSpawn(command, args, { cwd, stdio: 'pipe' })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()))

    const killTimer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, timeout)
    killTimer.unref()

    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(killTimer)
      resolve({ status: null, signal: null, stdout, stderr, error })
    })
    child.on('close', (status, signal) => {
      clearTimeout(killTimer)
      const error = timedOut
        ? Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' })
        : undefined
      resolve({ status, signal, stdout, stderr, error })
    })
  })
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
    'Preserve every action the user recorded unless it is clearly invalid',
    'or an accidental duplicate. If you drop or rewrite any recorded',
    'action, you must say which and why in the summary below.',
    '',
    'If the file already follows convention, make no changes.',
    '',
    'When you are done, print a short summary of what you changed, written',
    'for someone who does not read code, between these exact markers on',
    'their own lines:',
    SUMMARY_START,
    '(your summary here)',
    SUMMARY_END
  ].join('\n')
}

export function parseChangeSummary(stdout: string): string | undefined {
  const startAt = stdout.indexOf(SUMMARY_START)
  if (startAt === -1) return undefined
  const afterStart = startAt + SUMMARY_START.length
  const endAt = stdout.indexOf(SUMMARY_END, afterStart)
  if (endAt === -1) return undefined
  const summary = stdout.slice(afterStart, endAt).trim()
  return summary || undefined
}

/**
 * Hands the recorded spec to a local coding-agent CLI for a one-shot
 * convention pass. The caller is responsible for getting the user's consent
 * first — this never runs silently.
 */
export async function runAgentRefactor(
  options: RefactorOptions
): Promise<RefactorResult> {
  const { adapter, specPath, projectRoot, onProgress } = options
  const spawn = options.spawn ?? realSpawn
  const prompt = buildPrompt(specPath)
  const args = adapter.buildArgs(prompt)

  const startedAt = Date.now()
  const progressTimer = onProgress
    ? setInterval(
        () => onProgress(Date.now() - startedAt),
        PROGRESS_INTERVAL_MS
      )
    : undefined
  progressTimer?.unref()

  let result: SpawnResult
  try {
    result = await spawn(adapter.command, args, projectRoot, TIMEOUT_MS)
  } finally {
    if (progressTimer) clearInterval(progressTimer)
  }

  if (result.error) {
    const timedOut = result.error.code === 'ETIMEDOUT'
    return timedOut
      ? { ran: false, timedOut: true }
      : { ran: false, error: result.error.message }
  }
  if (result.status !== 0) {
    return { ran: false, error: result.stderr?.trim() }
  }
  return { ran: true, summary: parseChangeSummary(result.stdout ?? '') }
}
