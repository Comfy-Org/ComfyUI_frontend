import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

import { isMainModule } from '../isMainModule'
import { changedRanges, isGatedPath } from '../server-fact-gate-core'
import { lintSnapshot } from '../server-fact-oxlint'
import type { HookDecision, HookEvent, SnapshotLint } from './server-fact-hook'
import { findingsReport, reviewSnapshot, runHook } from './server-fact-hook'

const GUARDED_REPO = 'comfy-org/comfyui_frontend'
const GUARDED_REMOTE = 'https://github.com/Comfy-Org/ComfyUI_frontend.git'
const repoRoot = path.resolve(import.meta.dirname, '../..')

export interface Approval {
  pr: string | undefined
  repo: string | undefined
}

const SHELL_TOKEN =
  /'[^']*'|"(?:[^"\\]|\\.)*"|&&|\|\||[;|&\n]|(?:[^\s'"\\;|&]|\\.)+|[ \t]+/g
const SHELL_OPERATOR = /^(?:&&|\|\||[;|&\n])$/
const SHELL_SPACE = /^[ \t]+$/
const INLINE_FLAG = /^(--[^=]+)=(.*)$/s
const PR_URL = /github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/
const REVIEWS_ENDPOINT =
  /^\/?repos\/([^/]+\/[^/]+)\/pulls\/(\d+)\/reviews(?:\/\d+\/events)?$/
const APPROVE_PAYLOAD = /"event"\s*:\s*"APPROVE"/
const REVIEW_VALUE_FLAGS = new Set([
  '-b',
  '--body',
  '-F',
  '--body-file',
  '-R',
  '--repo'
])
const API_VALUE_FLAGS = new Set([
  '-X',
  '--method',
  '-H',
  '--header',
  '-f',
  '--raw-field',
  '-F',
  '--field',
  '--input',
  '-q',
  '--jq',
  '-t',
  '--template',
  '--hostname',
  '-p',
  '--preview',
  '--cache'
])
const API_FIELD_FLAGS = new Set(['-f', '--raw-field', '-F', '--field'])

const unescape = (text: string) => text.replace(/\\(.)/gs, '$1')

/** Splits a shell command into simple commands of unquoted words; enough to spot a gh call. */
function shellSegments(command: string): string[][] {
  const segments: string[][] = []
  let current: string[] = []
  let word: string | undefined
  const endWord = () => {
    if (word !== undefined) current.push(word)
    word = undefined
  }
  for (const [token] of command.matchAll(SHELL_TOKEN)) {
    if (SHELL_OPERATOR.test(token)) {
      endWord()
      segments.push(current)
      current = []
    } else if (SHELL_SPACE.test(token)) {
      endWord()
    } else {
      word = (word ?? '') + unquote(token)
    }
  }
  endWord()
  return [...segments, current]
}

function unquote(token: string): string {
  if (token.startsWith("'")) return token.slice(1, -1)
  return unescape(token.startsWith('"') ? token.slice(1, -1) : token)
}

function parseFlags(
  tokens: readonly string[],
  valueFlags: ReadonlySet<string>
): { positionals: string[]; flags: [string, string | undefined][] } {
  const positionals: string[] = []
  const flags: [string, string | undefined][] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const inline = INLINE_FLAG.exec(token)
    if (!token.startsWith('-') || token === '-') positionals.push(token)
    else if (inline) flags.push([inline[1], inline[2]])
    else if (valueFlags.has(token)) flags.push([token, tokens.at(++i)])
    else flags.push([token, undefined])
  }
  return { positionals, flags }
}

function flagValue(
  flags: readonly [string, string | undefined][],
  names: readonly string[]
): string | undefined {
  return flags.find(([name]) => names.includes(name))?.[1]
}

function reviewApproval(args: readonly string[]): Approval | undefined {
  const { positionals, flags } = parseFlags(args, REVIEW_VALUE_FLAGS)
  if (!flags.some(([name]) => name === '--approve' || name === '-a')) {
    return undefined
  }
  const pr = positionals.at(0)
  const url = pr === undefined ? null : PR_URL.exec(pr)
  return {
    pr,
    repo: url?.[1] ?? flagValue(flags, ['-R', '--repo'])
  }
}

function apiApproval(
  args: readonly string[],
  command: string,
  readInput: (file: string) => string
): Approval | undefined {
  const { positionals, flags } = parseFlags(args, API_VALUE_FLAGS)
  const endpoint = REVIEWS_ENDPOINT.exec(positionals.at(0) ?? '')
  if (!endpoint) return undefined
  const input = flagValue(flags, ['--input'])
  const approves =
    flags.some(
      ([name, value]) => API_FIELD_FLAGS.has(name) && value === 'event=APPROVE'
    ) ||
    (input !== undefined &&
      APPROVE_PAYLOAD.test(input === '-' ? command : readInput(input)))
  if (!approves) return undefined
  const repo = endpoint[1]
  return { pr: endpoint[2], repo: repo === '{owner}/{repo}' ? undefined : repo }
}

/** The PR a shell command approves, or undefined when it approves nothing. */
export function classifyApproval(
  command: string,
  readInput: (file: string) => string
): Approval | undefined {
  for (const tokens of shellSegments(command)) {
    const start = tokens.findIndex((token) => !/^\w+=/.test(token))
    const [program, group, verb, ...rest] = tokens.slice(start)
    if (program !== 'gh') continue
    const approval =
      group === 'pr' && verb === 'review'
        ? reviewApproval(rest)
        : group === 'api'
          ? apiApproval([verb, ...rest], command, readInput)
          : undefined
    if (approval) return approval
  }
  return undefined
}

const commandSchema = z.object({ command: z.string() })
const pullRequestSchema = z.object({
  url: z.string(),
  headRefOid: z.string(),
  baseRefOid: z.string()
})

const ALLOW: HookDecision = { kind: 'allow' }

const isGuardedRepo = (repo: string) => repo.toLowerCase() === GUARDED_REPO

export function approvalDecision(
  diff: string,
  textAtHead: (file: string) => string,
  lint: SnapshotLint = lintSnapshot
): HookDecision {
  const rangesByFile = new Map(
    [...changedRanges(diff)].filter(([file]) => isGatedPath(file))
  )
  if (rangesByFile.size === 0) return ALLOW
  const review = reviewSnapshot(rangesByFile, textAtHead, lint)
  if (!review.ok) return { kind: 'warn', warning: review.detail }
  return review.findings.length === 0
    ? ALLOW
    : {
        kind: 'block',
        report: findingsReport(
          review.findings,
          'Approval blocked until these are resolved.'
        )
      }
}

function run(program: string, args: string[], cwd: string): string {
  return execFileSync(program, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

function hasCommit(oid: string): boolean {
  try {
    run('git', ['cat-file', '-e', `${oid}^{commit}`], repoRoot)
    return true
  } catch {
    return false
  }
}

function pullRequestDiff(head: string, base: string): string {
  const missing = [head, base].filter((oid) => !hasCommit(oid))
  if (missing.length > 0) {
    run(
      'git',
      [
        'fetch',
        '--quiet',
        '--no-tags',
        '--no-write-fetch-head',
        GUARDED_REMOTE,
        ...missing
      ],
      repoRoot
    )
  }
  const mergeBase = run('git', ['merge-base', base, head], repoRoot).trim()
  return run(
    'git',
    [
      '-c',
      'core.quotePath=false',
      'diff',
      '-U0',
      '--no-color',
      '--no-ext-diff',
      '--diff-filter=ACMR',
      mergeBase,
      head
    ],
    repoRoot
  )
}

function viewPullRequest(approval: Approval, cwd: string) {
  const json = run(
    'gh',
    [
      'pr',
      'view',
      ...(approval.pr === undefined ? [] : [approval.pr]),
      ...(approval.repo === undefined ? [] : ['--repo', approval.repo]),
      '--json',
      'url,headRefOid,baseRefOid'
    ],
    cwd
  )
  return pullRequestSchema.parse(JSON.parse(json))
}

/** Network and git failures throw; runHook turns them into an allow with a warning. */
export function decideApproval(
  event: HookEvent,
  lint: SnapshotLint = lintSnapshot
): HookDecision {
  const command = commandSchema.safeParse(event.tool_input).data?.command
  if (command === undefined) return ALLOW
  const cwd = event.cwd ?? process.cwd()
  const approval = classifyApproval(command, (file) =>
    readFileSync(path.resolve(cwd, file), 'utf8')
  )
  if (!approval) return ALLOW
  if (approval.repo !== undefined && !isGuardedRepo(approval.repo)) return ALLOW

  const pr = viewPullRequest(approval, cwd)
  const repo = PR_URL.exec(pr.url)?.[1]
  if (repo === undefined || !isGuardedRepo(repo)) return ALLOW

  return approvalDecision(
    pullRequestDiff(pr.headRefOid, pr.baseRefOid),
    (file) => run('git', ['show', `${pr.headRefOid}:${file}`], repoRoot),
    lint
  )
}

if (isMainModule(import.meta.url)) {
  await runHook((event) => decideApproval(event))
}
