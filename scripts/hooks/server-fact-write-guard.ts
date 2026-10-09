import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { z } from 'zod'

import { isMainModule } from '../isMainModule'
import type { ChangedRange, Finding } from '../server-fact-gate-core'
import { changedRanges, isGatedPath } from '../server-fact-gate-core'
import { SERVER_FACT_CONFIG, lintSnapshot } from '../server-fact-oxlint'
import type { HookDecision, HookEvent, SnapshotLint } from './server-fact-hook'
import { findingsReport, reviewSnapshot, runHook } from './server-fact-hook'

const editSchema = z.object({
  old_string: z.string(),
  new_string: z.string(),
  replace_all: z.boolean().optional()
})
const filePathSchema = z.object({ file_path: z.string() })
const writeSchema = z.object({ content: z.string() })
const multiEditSchema = z.object({ edits: z.array(editSchema) })

type Edit = z.infer<typeof editSchema>

const DISABLE_DIRECTIVE =
  /\b(?:oxlint|eslint)-disable(?:-next-line|-line)?\b(.*)$/
const SERVER_FACT_RULE = /no-capability-recombination|no-server-fact-literals/

function applyEdit(text: string | undefined, edit: Edit): string | undefined {
  if (text === undefined) {
    return edit.old_string === '' ? edit.new_string : undefined
  }
  if (edit.old_string === '') return undefined
  const parts = text.split(edit.old_string)
  if (parts.length === 1) return undefined
  if (edit.replace_all) return parts.join(edit.new_string)
  if (parts.length > 2) return undefined
  return parts.join(edit.new_string)
}

/** The file as the tool would leave it, or undefined when the tool will refuse the edit. */
export function proposedContent(
  toolName: string,
  input: unknown,
  before: string | undefined
): string | undefined {
  switch (toolName) {
    case 'Write':
      return writeSchema.safeParse(input).data?.content
    case 'Edit': {
      const edit = editSchema.safeParse(input).data
      return edit && applyEdit(before, edit)
    }
    case 'MultiEdit': {
      const edits = multiEditSchema.safeParse(input).data?.edits
      return edits?.reduce<string | undefined>(
        (text, edit) =>
          text === undefined ? undefined : applyEdit(text, edit),
        before
      )
    }
    default:
      return undefined
  }
}

function disablesServerFactRules(line: string): boolean {
  const directive = DISABLE_DIRECTIVE.exec(line)
  if (!directive) return false
  const ruleList = directive[1].replace(/\*\/.*$|--.*$/, '').trim()
  return ruleList === '' || SERVER_FACT_RULE.test(ruleList)
}

export function disableDirectiveFindings(
  file: string,
  text: string,
  ranges: readonly ChangedRange[]
): Finding[] {
  const lines = text.split('\n')
  return ranges.flatMap((range) =>
    range.kind === 'deleted'
      ? []
      : lines.slice(range.start - 1, range.end).flatMap((line, index) =>
          disablesServerFactRules(line)
            ? [
                {
                  filename: file,
                  line: range.start + index,
                  message:
                    'An inline disable turns off the server-fact rules. Fix the gate instead of suppressing the check.'
                }
              ]
            : []
        )
  )
}

function lineCount(text: string): number {
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
}

function proposedRanges(
  file: string,
  before: string | undefined,
  after: string
): readonly ChangedRange[] | undefined {
  if (before === undefined) {
    const end = lineCount(after)
    return end === 0 ? [] : [{ kind: 'added', start: 1, end }]
  }
  const dir = mkdtempSync(path.join(tmpdir(), 'server-fact-diff-'))
  try {
    for (const [side, text] of [
      ['a', before],
      ['b', after]
    ] as const) {
      mkdirSync(path.dirname(path.join(dir, side, file)), { recursive: true })
      writeFileSync(path.join(dir, side, file), text)
    }
    const diff = spawnSync(
      'git',
      [
        '-c',
        'core.quotePath=false',
        'diff',
        '--no-index',
        '--no-prefix',
        '-U0',
        '--no-color',
        '--no-ext-diff',
        `a/${file}`,
        `b/${file}`
      ],
      { cwd: dir, encoding: 'utf8' }
    )
    if (diff.status !== 0 && diff.status !== 1) return undefined
    return changedRanges(diff.stdout).get(file) ?? []
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function repoRootOf(file: string): string | undefined {
  const parent = path.dirname(file)
  if (existsSync(path.join(parent, '.git'))) return parent
  return parent === file ? undefined : repoRootOf(parent)
}

function readIfExists(file: string): string | undefined {
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}

function gatedTarget(
  event: HookEvent
): { absolute: string; file: string } | undefined {
  const filePath = filePathSchema.safeParse(event.tool_input).data?.file_path
  if (filePath === undefined) return undefined
  const absolute = path.resolve(event.cwd ?? process.cwd(), filePath)
  const root = repoRootOf(absolute)
  if (root === undefined) return undefined
  const file = path.relative(root, absolute).split(path.sep).join('/')
  return isGatedPath(file) ? { absolute, file } : undefined
}

function decideWrite(event: HookEvent, lint: SnapshotLint): HookDecision {
  const target = gatedTarget(event)
  if (!target) return { kind: 'allow' }
  const before = readIfExists(target.absolute)
  const after = proposedContent(event.tool_name, event.tool_input, before)
  return after === undefined
    ? { kind: 'allow' }
    : reviewEdit(target.file, before, after, lint)
}

function reviewEdit(
  file: string,
  before: string | undefined,
  after: string,
  lint: SnapshotLint
): HookDecision {
  const ranges = proposedRanges(file, before, after)
  if (ranges === undefined) {
    return { kind: 'warn', warning: 'git diff --no-index failed' }
  }
  if (ranges.length === 0) return { kind: 'allow' }
  const review = reviewSnapshot(new Map([[file, ranges]]), () => after, lint)
  if (!review.ok) return { kind: 'warn', warning: review.detail }

  const findings = [
    ...review.findings,
    ...disableDirectiveFindings(file, after, ranges)
  ].sort((a, b) => a.line - b.line)
  return findings.length === 0
    ? { kind: 'allow' }
    : { kind: 'block', report: findingsReport(findings) }
}

if (isMainModule(import.meta.url)) {
  const config = process.env.SERVER_FACT_OXLINT_CONFIG ?? SERVER_FACT_CONFIG
  await runHook((event) =>
    decideWrite(event, (contents) => lintSnapshot(contents, config))
  )
}
