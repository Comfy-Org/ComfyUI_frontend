import { parse as tokenize } from 'shell-quote'

import type { Cmd, Node, Redirect } from './types'

type Token =
  | string
  | { op: string; pattern?: string }
  | { pattern: string }
  | { comment: string }

const UNSUPPORTED_OPS = new Set([
  '(',
  ')',
  '&',
  '<',
  '<<',
  '<<<',
  '<(',
  '>(',
  '>&',
  '<&'
])

export function parseScript(src: string, env?: Record<string, string>): Node {
  const tokens = tokenize(src, env) as Token[]
  if (tokens.length === 0) {
    return { type: 'simple', cmd: { argv: [] } }
  }
  for (const t of tokens) {
    if (typeof t === 'object') {
      if ('pattern' in t && !('op' in t)) {
        throw new Error(`glob not supported: ${t.pattern}`)
      }
      if ('comment' in t) continue
      if ('op' in t) {
        const op = t.op
        if (op === 'glob') {
          throw new Error(`glob not supported: ${t.pattern ?? ''}`)
        }
        if (UNSUPPORTED_OPS.has(op)) {
          throw new Error(`unsupported operator: ${op}`)
        }
      }
    }
  }
  return foldSeq(tokens)
}

function splitBy(tokens: Token[], ops: string[]): Token[][] {
  const parts: Token[][] = [[]]
  for (const t of tokens) {
    if (typeof t === 'object' && 'op' in t && ops.includes(t.op)) {
      parts.push([{ op: t.op } as Token], [])
    } else {
      parts[parts.length - 1].push(t)
    }
  }
  return parts
}

function foldSeq(tokens: Token[]): Node {
  const parts = splitBy(tokens, [';'])
  const segs: Token[][] = []
  for (let i = 0; i < parts.length; i += 2) segs.push(parts[i])
  const filtered = segs.filter((s) => s.length > 0)
  if (filtered.length === 0) return { type: 'simple', cmd: { argv: [] } }
  let acc = foldLogical(filtered[0])
  for (let i = 1; i < filtered.length; i++) {
    acc = { type: 'seq', left: acc, right: foldLogical(filtered[i]) }
  }
  return acc
}

function foldLogical(tokens: Token[]): Node {
  const parts: Array<{ op?: '&&' | '||'; toks: Token[] }> = [{ toks: [] }]
  for (const t of tokens) {
    if (
      typeof t === 'object' &&
      'op' in t &&
      (t.op === '&&' || t.op === '||')
    ) {
      parts.push({ op: t.op, toks: [] })
    } else {
      parts[parts.length - 1].toks.push(t)
    }
  }
  let acc = foldPipe(parts[0].toks)
  for (let i = 1; i < parts.length; i++) {
    const right = foldPipe(parts[i].toks)
    acc = { type: parts[i].op === '&&' ? 'and' : 'or', left: acc, right }
  }
  return acc
}

function foldPipe(tokens: Token[]): Node {
  const parts = splitBy(tokens, ['|'])
  const segs: Token[][] = []
  for (let i = 0; i < parts.length; i += 2) segs.push(parts[i])
  const cmds = segs.map(toCmd)
  if (cmds.length === 1) {
    return { type: 'simple', cmd: cmds[0] }
  }
  const last = cmds[cmds.length - 1]
  const redirect = last.redirect
  const pipeCmds = cmds.map((c, i) =>
    i === cmds.length - 1 ? { ...c, redirect: undefined } : c
  )
  return { type: 'pipe', cmds: pipeCmds, redirect }
}

function toCmd(tokens: Token[]): Cmd {
  const argv: string[] = []
  let redirect: Redirect | undefined
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (typeof t === 'string') {
      argv.push(t)
    } else if (typeof t === 'object' && 'op' in t) {
      if (t.op === '>' || t.op === '>>') {
        const next = tokens[i + 1]
        if (typeof next !== 'string') {
          throw new Error(`redirect target missing after ${t.op}`)
        }
        redirect = { op: t.op, path: next }
        i++
      } else {
        throw new Error(`unexpected operator in command: ${t.op}`)
      }
    }
  }
  return { argv, redirect }
}
