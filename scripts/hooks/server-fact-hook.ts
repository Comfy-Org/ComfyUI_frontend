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

function exitWith(decision: HookDecision): never {
  if (decision.kind === 'block') {
    process.stderr.write(`${decision.report}\n`)
    process.exit(2)
  }
  if (decision.kind === 'warn') {
    process.stderr.write(`server-fact hook skipped: ${decision.warning}\n`)
  }
  process.exit(0)
}

/** A broken guard must never block the tool, so every internal failure allows it. */
export async function runHook(
  decide: (event: HookEvent) => HookDecision
): Promise<never> {
  try {
    const event = hookEventSchema.safeParse(JSON.parse(await readStdin()))
    if (!event.success) {
      return exitWith({ kind: 'warn', warning: 'unreadable hook event' })
    }
    return exitWith(decide(event.data))
  } catch (error) {
    return exitWith({ kind: 'warn', warning: String(error) })
  }
}
