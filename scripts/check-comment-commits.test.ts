import { describe, expect, it } from 'vitest'

import {
  analyzeStagedDiff,
  commentSyntaxForFile,
  freshScanState,
  scanLine
} from './check-comment-commits'

function diff(file: string, addedLines: string[], removedLines: string[] = []) {
  const body = [
    ...removedLines.map((l) => `-${l}`),
    ...addedLines.map((l) => `+${l}`)
  ].join('\n')
  return [
    `diff --git a/${file} b/${file}`,
    `--- a/${file}`,
    `+++ b/${file}`,
    `@@ -1,${Math.max(removedLines.length, 1)} +1,${Math.max(addedLines.length, 1)} @@`,
    body
  ].join('\n')
}

describe('scanLine', () => {
  const ts = { line: true, block: true, html: false }

  it('classifies a full-line comment as comment-only', () => {
    const r = scanLine('// a note', freshScanState(), ts)
    expect(r.hasComment).toBe(true)
    expect(r.hasCode).toBe(false)
  })

  it('classifies plain code as code-only', () => {
    const r = scanLine('const x = 5', freshScanState(), ts)
    expect(r.hasComment).toBe(false)
    expect(r.hasCode).toBe(true)
  })

  it('flags a trailing inline comment as both code and comment', () => {
    const r = scanLine('const x = 5 // why', freshScanState(), ts)
    expect(r.hasComment).toBe(true)
    expect(r.hasCode).toBe(true)
  })

  it('does not treat // inside a string literal as a comment', () => {
    const r = scanLine("const u = 'http://comfy.org'", freshScanState(), ts)
    expect(r.hasComment).toBe(false)
    expect(r.hasCode).toBe(true)
  })

  it('does not treat an escaped slash in a regex literal as a comment', () => {
    const r = scanLine(
      "file = target.replace(/^b\\//, '')",
      freshScanState(),
      ts
    )
    expect(r.hasComment).toBe(false)
    expect(r.hasCode).toBe(true)
  })

  it('does not treat a regex matching a comment marker as a comment', () => {
    const r = scanLine('const re = /^\\/\\*/', freshScanState(), ts)
    expect(r.hasComment).toBe(false)
    expect(r.hasCode).toBe(true)
  })

  it('treats JSDoc as a comment (no exemption)', () => {
    const r = scanLine('/** docs */', freshScanState(), ts)
    expect(r.hasComment).toBe(true)
    expect(r.hasCode).toBe(false)
  })

  it('tracks block comments across lines', () => {
    const open = scanLine('/*', freshScanState(), ts)
    const mid = scanLine(' * still a comment', open.state, ts)
    expect(mid.hasComment).toBe(true)
    expect(mid.hasCode).toBe(false)
    const close = scanLine(' */', mid.state, ts)
    expect(close.hasComment).toBe(true)
    expect(close.state.inBlock).toBe(false)
  })
})

describe('commentSyntaxForFile', () => {
  it('enables html comments for vue', () => {
    expect(commentSyntaxForFile('Foo.vue')?.html).toBe(true)
  })

  it('disables line comments for css', () => {
    expect(commentSyntaxForFile('a.css')).toEqual({
      line: false,
      block: true,
      html: false
    })
  })

  it('ignores non-code files', () => {
    expect(commentSyntaxForFile('data.json')).toBeNull()
    expect(commentSyntaxForFile('readme.md')).toBeNull()
  })
})

describe('analyzeStagedDiff', () => {
  it('blocks code changes mixed with new comments', () => {
    const result = analyzeStagedDiff(
      diff('src/a.ts', ['const x = 5', '// explain x'])
    )
    expect(result.violation).toBe(true)
    expect(result.commentAdds).toEqual([
      { file: 'src/a.ts', line: 2, text: '// explain x' }
    ])
  })

  it('blocks a trailing comment added to a code line', () => {
    const result = analyzeStagedDiff(
      diff('src/a.ts', ['const x = 5 // explain'])
    )
    expect(result.violation).toBe(true)
  })

  it('allows a comment-only commit', () => {
    const result = analyzeStagedDiff(
      diff('src/a.ts', ['// a standalone note', '// another line'])
    )
    expect(result.violation).toBe(false)
    expect(result.hasCommentAdd).toBe(true)
    expect(result.hasCodeChange).toBe(false)
  })

  it('allows a code-only commit', () => {
    const result = analyzeStagedDiff(
      diff('src/a.ts', ['const x = 5', 'const y = 6'])
    )
    expect(result.violation).toBe(false)
  })

  it('blocks comments added in one file when code changes in another', () => {
    const combined = [
      diff('src/a.ts', ['const x = 5']),
      diff('src/b.ts', ['// just a note'])
    ].join('\n')
    expect(analyzeStagedDiff(combined).violation).toBe(true)
  })

  it('treats removing code as a code change', () => {
    const result = analyzeStagedDiff(
      diff('src/a.ts', ['// note'], ['const gone = 1'])
    )
    expect(result.violation).toBe(true)
  })

  it('ignores comment-shaped changes in non-code files', () => {
    const result = analyzeStagedDiff(
      diff('config.json', ['  "key": "value // not a comment"'])
    )
    expect(result.violation).toBe(false)
    expect(result.hasCommentAdd).toBe(false)
    expect(result.hasCodeChange).toBe(false)
  })

  it('uses real new-file line numbers from the hunk header', () => {
    const patch = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -40,3 +40,4 @@',
      ' const before = 1',
      '+doWork() // inline',
      ' const after = 2'
    ].join('\n')
    const result = analyzeStagedDiff(patch)
    expect(result.commentAdds[0].line).toBe(41)
  })
})
