#!/usr/bin/env tsx
import { execSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export interface CommentSyntax {
  line: boolean
  block: boolean
  html: boolean
}

const TS_LIKE: CommentSyntax = { line: true, block: true, html: false }
const VUE_LIKE: CommentSyntax = { line: true, block: true, html: true }
const BLOCK_ONLY: CommentSyntax = { line: false, block: true, html: false }

export function commentSyntaxForFile(filePath: string): CommentSyntax | null {
  const ext = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'mts':
    case 'cts':
    case 'js':
    case 'mjs':
    case 'cjs':
    case 'jsx':
      return TS_LIKE
    case 'vue':
      return VUE_LIKE
    case 'css':
      return BLOCK_ONLY
    default:
      return null
  }
}

export interface ScanState {
  inBlock: boolean
  inTemplate: boolean
  inHtml: boolean
}

export function freshScanState(): ScanState {
  return { inBlock: false, inTemplate: false, inHtml: false }
}

export interface LineScan {
  hasComment: boolean
  hasCode: boolean
  state: ScanState
}

export function scanLine(
  text: string,
  state: ScanState,
  syntax: CommentSyntax
): LineScan {
  let { inBlock, inTemplate, inHtml } = state
  let hasComment = false
  let hasCode = false
  let i = 0
  const n = text.length

  while (i < n) {
    const c = text[i]
    const c2 = text[i + 1]

    if (inBlock) {
      hasComment = true
      if (c === '*' && c2 === '/') {
        inBlock = false
        i += 2
        continue
      }
      i++
      continue
    }

    if (inHtml) {
      hasComment = true
      if (c === '-' && c2 === '-' && text[i + 2] === '>') {
        inHtml = false
        i += 3
        continue
      }
      i++
      continue
    }

    if (inTemplate) {
      hasCode = true
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === '`') {
        inTemplate = false
      }
      i++
      continue
    }

    if (c === ' ' || c === '\t' || c === '\r') {
      i++
      continue
    }

    if (c === '\\') {
      hasCode = true
      i += 2
      continue
    }

    if (syntax.line && c === '/' && c2 === '/') {
      hasComment = true
      break
    }

    if (syntax.block && c === '/' && c2 === '*') {
      inBlock = true
      hasComment = true
      i += 2
      continue
    }

    if (
      syntax.html &&
      c === '<' &&
      c2 === '!' &&
      text[i + 2] === '-' &&
      text[i + 3] === '-'
    ) {
      inHtml = true
      hasComment = true
      i += 4
      continue
    }

    if (c === "'" || c === '"') {
      hasCode = true
      i++
      while (i < n) {
        if (text[i] === '\\') {
          i += 2
          continue
        }
        if (text[i] === c) {
          i++
          break
        }
        i++
      }
      continue
    }

    if (c === '`') {
      hasCode = true
      inTemplate = true
      i++
      continue
    }

    hasCode = true
    i++
  }

  return { hasComment, hasCode, state: { inBlock, inTemplate, inHtml } }
}

export interface CommentAdd {
  file: string
  line: number
  text: string
}

export interface DiffAnalysis {
  violation: boolean
  hasCommentAdd: boolean
  hasCodeChange: boolean
  commentAdds: CommentAdd[]
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/

export function analyzeStagedDiff(diff: string): DiffAnalysis {
  let file: string | null = null
  let syntax: CommentSyntax | null = null
  let newState = freshScanState()
  let oldState = freshScanState()
  let newLine = 0

  let hasCommentAdd = false
  let hasCodeChange = false
  const commentAdds: CommentAdd[] = []

  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      file = null
      syntax = null
      continue
    }

    if (raw.startsWith('+++ ')) {
      const target = raw.slice(4).trim()
      if (target === '/dev/null') {
        file = null
        syntax = null
        continue
      }
      file = target.replace(/^b\//, '')
      syntax = commentSyntaxForFile(file)
      continue
    }

    if (!file || !syntax) continue

    const hunk = HUNK_HEADER.exec(raw)
    if (hunk) {
      newLine = Number(hunk[1])
      newState = freshScanState()
      oldState = freshScanState()
      continue
    }

    if (raw.startsWith('--- ')) continue
    if (raw.startsWith('\\')) continue

    const marker = raw[0]
    const content = raw.slice(1)

    if (marker === ' ') {
      newState = scanLine(content, newState, syntax).state
      oldState = scanLine(content, oldState, syntax).state
      newLine++
      continue
    }

    if (marker === '+') {
      const scan = scanLine(content, newState, syntax)
      newState = scan.state
      if (scan.hasComment) {
        hasCommentAdd = true
        commentAdds.push({ file, line: newLine, text: content.trim() })
      }
      if (scan.hasCode) hasCodeChange = true
      newLine++
      continue
    }

    if (marker === '-') {
      const scan = scanLine(content, oldState, syntax)
      oldState = scan.state
      if (scan.hasCode) hasCodeChange = true
    }
  }

  return {
    violation: hasCommentAdd && hasCodeChange,
    hasCommentAdd,
    hasCodeChange,
    commentAdds
  }
}

function getStagedDiff(): string {
  return execSync('git diff --cached --no-color --no-ext-diff -U3', {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024
  })
}

function reportViolation(commentAdds: CommentAdd[]): void {
  const shown = commentAdds.slice(0, 20)
  const lines = shown
    .map(({ file, line, text }) => `  ${file}:${line}  ${text}`)
    .join('\n')
  const overflow =
    commentAdds.length > shown.length
      ? `\n  …and ${commentAdds.length - shown.length} more`
      : ''

  process.stderr.write(
    [
      'Commit blocked: contains both comments and code changes',
      '',
      'New comments in this commit:',
      lines + overflow,
      '',
      'Due to LLM abuse, commits with both comments and code are forbidden.',
      'Delete the comments immediately.',
      'If the comments are actually required, they can be rewritten in a',
      'standalone commit.',
      ''
    ].join('\n')
  )
}

function main(): void {
  const analysis = analyzeStagedDiff(getStagedDiff())
  if (!analysis.violation) return
  reportViolation(analysis.commentAdds)
  process.exit(1)
}

const invokedDirectly = (() => {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry)
  } catch {
    return false
  }
})()

if (invokedDirectly) main()
