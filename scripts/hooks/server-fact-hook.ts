import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

import { GUIDANCE } from '../../tools/oxlint-plugins/serverFacts'
import type { ChangedRange, Finding } from '../server-fact-gate-core'
import { findingsInFiles } from '../server-fact-gate-core'
import type { LintOutcome } from '../server-fact-oxlint'
import { lintSnapshot } from '../server-fact-oxlint'

const hookEventSchema = z.object({
  tool_name: z.string(),
  tool_input: z.unknown(),
  cwd: z.string().optional()
})

export type HookEvent = z.infer<typeof hookEventSchema>

export type HookDecision =
  | { kind: 'allow' }
  | { kind: 'block'; report: string }
  | { kind: 'warn'; warning: string }

export type SnapshotLint = (
  contents: ReadonlyMap<string, string>
) => LintOutcome

export type SnapshotReview =
  | { ok: true; findings: Finding[] }
  | { ok: false; detail: string }

const AGENT_GUIDANCE = [
  'Render each server fact as received: no &&, ||, ??, ternary, comparison or helper around it, and do not choose which fact answers the question.',
  'Local UI state (loading, in-flight, validity) may only narrow it, as in canTopUp && !isLoading.',
  "If the UI needs a fact the API does not emit, open a backend ticket and wrap the interim expression in pendingServerFact('BE-xxxx', ...).",
  'Never substitute another field: can_change_seats is not member management.',
  'See docs/adr/API-SERVER-FACTS-0042-server-facts-are-rendered-not-derived.md'
].join('\n')

export function reviewSnapshot(
  rangesByFile: ReadonlyMap<string, readonly ChangedRange[]>,
  textOf: (file: string) => string,
  lint: SnapshotLint = lintSnapshot
): SnapshotReview {
  const contents = new Map(
    [...rangesByFile.keys()].map((file) => [file, textOf(file)])
  )
  const result = lint(contents)
  if (!result.ok) return result
  return {
    ok: true,
    findings: findingsInFiles(
      rangesByFile,
      result.diagnostics,
      (file) => contents.get(file) ?? ''
    )
  }
}

export function findingsReport(
  findings: readonly Finding[],
  verdict?: string
): string {
  const lines = findings.map(
    ({ filename, line, message }) =>
      `server-fact: ${filename}:${line} ${message.replace(` ${GUIDANCE}`, '')}`
  )
  return [...lines, ...(verdict ? [verdict] : []), AGENT_GUIDANCE].join('\n')
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

const SKIP_LOG = 'server-fact-guard-skips.log'
const SKIP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const skipEntrySchema = z.object({ ts: z.string() })

export function recentSkipCount(logText: string, now: Date): number {
  return logText
    .split('\n')
    .map((line) => skipEntrySchema.safeParse(parseJson(line)))
    .filter(
      (entry) =>
        entry.success &&
        now.getTime() - Date.parse(entry.data.ts) < SKIP_WINDOW_MS
    ).length
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function readOptional(file: string): string {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

/** Appends the skip to a log in the git common dir, shared by worktrees and never committed. */
function recordSkip(hook: string, reason: string, cwd: string): string {
  try {
    const gitDir = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim()
    const logPath = path.join(gitDir, SKIP_LOG)
    const now = new Date()
    appendFileSync(
      logPath,
      `${JSON.stringify({ ts: now.toISOString(), hook, reason })}\n`
    )
    const count = recentSkipCount(readOptional(logPath), now)
    return `${count} ${count === 1 ? 'skip' : 'skips'} in the last 7 days, see ${logPath}`
  } catch {
    return 'skip log unavailable'
  }
}

function exitWith(decision: HookDecision, hook: string, cwd: string): never {
  if (decision.kind === 'block') {
    process.stderr.write(`${decision.report}\n`)
    process.exit(2)
  }
  if (decision.kind === 'warn') {
    const record = recordSkip(hook, decision.warning, cwd)
    process.stderr.write(
      `server-fact guard skipped (${record}): ${decision.warning}\n`
    )
  }
  process.exit(0)
}

/**
 * A broken guard must never block the tool, so every internal failure allows
 * it. Each skip is logged so a broken hook cannot become a silent bypass.
 */
export async function runHook(
  hook: string,
  decide: (event: HookEvent) => HookDecision
): Promise<never> {
  let cwd = process.cwd()
  try {
    const event = hookEventSchema.safeParse(parseJson(await readStdin()))
    if (!event.success) {
      return exitWith(
        { kind: 'warn', warning: 'unreadable hook event' },
        hook,
        cwd
      )
    }
    cwd = event.data.cwd ?? cwd
    return exitWith(decide(event.data), hook, cwd)
  } catch (error) {
    return exitWith({ kind: 'warn', warning: String(error) }, hook, cwd)
  }
}
