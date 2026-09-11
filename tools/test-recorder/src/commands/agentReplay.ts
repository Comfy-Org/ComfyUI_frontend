import type { SpawnSyncOptions } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { confirm, isCancel, select } from '@clack/prompts'
import type { ConfirmOptions, SelectOptions } from '@clack/prompts'

import { parseFlags } from '../cli/flags'
import { runCommand } from '../cli/run'

export interface AgentReplayOptions {
  caseId?: string
  url?: string
  headed?: boolean
  video?: boolean
  help?: boolean
}

export interface AgentReplayInvocation {
  args: string[]
  env: Record<string, string>
}

const DEFAULT_URL = 'http://localhost:5173'
const CONVERSATIONS_DIR = 'browser_tests/fixtures/data/agent/conversations'

export const AGENT_REPLAY_USAGE = `Usage: comfy-test agent-replay [--case <id>] [--url <dev server>] [--headed] [--video]

Replays the recorded agent conversations under ${CONVERSATIONS_DIR}/ as
Playwright tests against a running dev server (default ${DEFAULT_URL}).
With no flags on a terminal it asks which recording to replay and whether
to watch it; any flag, or a non-interactive stdin, runs without prompts.

  --case <id>   one recording (the JSON file name without .json)
  --url <url>   the dev server to test against
  --headed      show the browser
  --video       record each case under test-results/
  --help        show this help and run nothing
`

export function listReplayCases(root: string = process.cwd()): string[] {
  return readdirSync(join(root, CONVERSATIONS_DIR))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort()
}

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
  if (options.caseId)
    args.push(
      '-g',
      `(^|\\s)recorded ${options.caseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`
    )
  if (options.headed) args.push('--headed')
  // Video is the only local setting this command owns; PLAYWRIGHT_LOCAL would
  // switch it on for every run, so it is not set here.
  const env: Record<string, string> = {
    PLAYWRIGHT_TEST_URL: options.url ?? DEFAULT_URL,
    DISTRIBUTION: 'cloud'
  }
  if (options.video) env.RECORD_VIDEO = 'true'
  return { args, env }
}

type Prompts = {
  select: (opts: SelectOptions<string>) => Promise<string | symbol>
  confirm: (opts: ConfirmOptions) => Promise<boolean | symbol>
}

export async function promptAgentReplayOptions(
  cases: string[],
  prompts: Prompts = { select, confirm }
): Promise<AgentReplayOptions | null> {
  const caseId = await prompts.select({
    message: 'Which recorded conversation should replay?',
    options: [
      { value: '', label: 'All recordings' },
      ...cases.map((id) => ({ value: id, label: id }))
    ]
  })
  if (isCancel(caseId)) return null
  const headed = await prompts.confirm({
    message: 'Watch it in a headed browser?',
    initialValue: false
  })
  if (isCancel(headed)) return null
  return { caseId: caseId || undefined, headed }
}

type Runner = (
  command: string,
  args: string[],
  options: SpawnSyncOptions
) => { status: number | null }

export function runAgentReplay(
  options: AgentReplayOptions,
  run: Runner = runCommand
): number {
  if (options.help) {
    process.stdout.write(AGENT_REPLAY_USAGE)
    return 0
  }
  const { args, env } = agentReplayInvocation(options)
  const result = run('pnpm', args, {
    stdio: 'inherit',
    env: { ...process.env, ...env }
  })
  return result.status ?? 1
}

export interface AgentReplayCliDeps {
  run?: Runner
  prompts?: Prompts
  cases?: () => string[]
  interactive?: boolean
}

const VALUE_FLAGS = ['case', 'url'] as const
const PRESENCE_FLAGS = ['headed', 'video', 'help'] as const
const KNOWN_FLAGS = new Set<string>([...VALUE_FLAGS, ...PRESENCE_FLAGS])

export async function agentReplayCli(
  argv: string[],
  deps: AgentReplayCliDeps = {}
): Promise<number> {
  const { positional, flags } = parseFlags(argv, VALUE_FLAGS)
  const unknown = [
    ...positional,
    ...Object.keys(flags)
      .filter((flag) => !KNOWN_FLAGS.has(flag))
      .map((flag) => `--${flag}`)
  ]
  if (unknown.length > 0) {
    process.stderr.write(
      `unknown argument ${unknown.join(' ')}\n${AGENT_REPLAY_USAGE}`
    )
    return 1
  }
  const valued = PRESENCE_FLAGS.find((flag) => flags[flag])
  if (valued !== undefined) {
    process.stderr.write(`--${valued} takes no value\n${AGENT_REPLAY_USAGE}`)
    return 1
  }
  if (flags.help !== undefined) return runAgentReplay({ help: true }, deps.run)
  const missing = VALUE_FLAGS.find((flag) => flags[flag] === '')
  if (missing !== undefined) {
    process.stderr.write(`--${missing} needs a value\n${AGENT_REPLAY_USAGE}`)
    return 1
  }
  const cases = (deps.cases ?? listReplayCases)()
  if (flags.case !== undefined && !cases.includes(flags.case)) {
    process.stderr.write(
      `no recording named ${flags.case}; recordings: ${cases.join(', ')}\n`
    )
    return 1
  }
  const interactive =
    (deps.interactive ?? process.stdin.isTTY) && Object.keys(flags).length === 0
  const options = interactive
    ? await promptAgentReplayOptions(cases, deps.prompts)
    : {
        caseId: flags.case,
        url: flags.url,
        headed: flags.headed !== undefined,
        video: flags.video !== undefined
      }
  return options === null ? 0 : runAgentReplay(options, deps.run)
}
