import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  ScriptKind,
  ScriptTarget,
  createSourceFile,
  getLeadingCommentRanges,
  getTrailingCommentRanges
} from 'typescript'
import type { Node } from 'typescript'

import type { ArchitectureException } from './schema'

const DIRECTIVES = [
  {
    rule: 'comfy/no-restricted-paths',
    pattern: /(?:eslint|oxlint)-disable(?:-next-line|-line)?\b/
  },
  {
    rule: 'boundary-violation',
    pattern: /fallow-ignore-(?:next-line|file)\b/
  }
]

export interface Suppression {
  exceptionId?: string
  fingerprint: string
  source: string
}

function scriptKind(language: string): ScriptKind {
  if (language === 'tsx') return ScriptKind.TSX
  if (language === 'jsx') return ScriptKind.JSX
  if (language === 'js') return ScriptKind.JS
  return ScriptKind.TS
}

function scriptBodies(
  filename: string,
  source: string
): Array<{ body: string; kind: ScriptKind }> {
  if (!filename.endsWith('.vue'))
    return [
      { body: source, kind: scriptKind(filename.split('.').at(-1) ?? 'ts') }
    ]
  return [...source.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(
    ([, attributes = '', body]) => ({
      body,
      kind: scriptKind(attributes.match(/\blang=["'](\w+)["']/)?.[1] ?? 'js')
    })
  )
}

function comments(filename: string, source: string): string[] {
  return scriptBodies(filename, source).flatMap(({ body, kind }) => {
    if (!body.includes('-disable') && !body.includes('fallow-ignore')) return []
    const sourceFile = createSourceFile(
      filename,
      body,
      ScriptTarget.Latest,
      false,
      kind
    )
    const ranges = new Map<number, number>()
    const collect = (found: ReturnType<typeof getLeadingCommentRanges>) => {
      for (const { pos, end } of found ?? []) ranges.set(pos, end)
    }
    const visit = (node: Node): void => {
      collect(getLeadingCommentRanges(body, node.pos))
      collect(getTrailingCommentRanges(body, node.end))
      for (const child of node.getChildren(sourceFile)) visit(child)
    }
    collect(getLeadingCommentRanges(body, 0))
    visit(sourceFile)
    return [...ranges]
      .sort(([left], [right]) => left - right)
      .map(([start, end]) => body.slice(start, end))
  })
}

function suppressedRule(comment: string): string | undefined {
  for (const { rule, pattern } of DIRECTIVES) {
    const directive = pattern.exec(comment)
    if (!directive) continue
    const rules = comment
      .slice(directive.index + directive[0].length)
      .split(/--|architecture-exception:/, 1)[0]
      .replace(/\*\//g, '')
      .trim()
    if (!rules || rules.split(/[\s,]+/).includes(rule)) return rule
  }
  return undefined
}

export function findSuppressions(
  filename: string,
  source: string
): Suppression[] {
  const occurrences = new Map<string, number>()
  return comments(filename, source).flatMap((comment) => {
    const rule = suppressedRule(comment)
    if (!rule) return []
    const exceptionId = comment.match(
      /architecture-exception:\s*(DDD-EX-\d{3})/
    )?.[1]
    const base = exceptionId
      ? `named-suppression:${exceptionId}:${filename}:${rule}`
      : `anonymous-suppression:${filename}:${rule}`
    const occurrence = (occurrences.get(base) ?? 0) + 1
    occurrences.set(base, occurrence)
    return [
      { exceptionId, fingerprint: `${base}#${occurrence}`, source: filename }
    ]
  })
}

export function censusSuppressions(
  repositoryRoot: string,
  sourceFiles: string[]
): Suppression[] {
  return sourceFiles.flatMap((filename) =>
    findSuppressions(
      filename,
      readFileSync(join(repositoryRoot, filename), 'utf8')
    )
  )
}

export function ledgerErrors(
  suppressions: Suppression[],
  exceptions: ArchitectureException[]
): string[] {
  const unowned = suppressions.flatMap(({ exceptionId, fingerprint }) => {
    const owners = exceptions.filter(({ exactFingerprints }) =>
      exactFingerprints.includes(fingerprint)
    )
    if (owners.length > 1)
      return [
        `${fingerprint} is listed by more than one exception: ${owners.map(({ id }) => id).join(', ')}`
      ]
    if (!owners.length)
      return [
        `${fingerprint} is a new architecture suppression. Remove it, or have the owning team add it to one exception in exceptions.json.`
      ]
    if (exceptionId && owners[0].id !== exceptionId)
      return [
        `${fingerprint} names ${exceptionId} but is listed by ${owners[0].id}`
      ]
    return []
  })
  const current = new Set(suppressions.map(({ fingerprint }) => fingerprint))
  const stale = exceptions.flatMap(({ id, exactFingerprints }) =>
    exactFingerprints
      .filter((fingerprint) => !current.has(fingerprint))
      .map(
        (fingerprint) =>
          `${id} lists ${fingerprint}, which no longer exists. Delete it from exceptions.json.`
      )
  )
  return [...unowned, ...stale]
}
