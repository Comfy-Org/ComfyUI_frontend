import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import type { Approval } from './server-fact-approve-guard'
import {
  approvalDecision,
  classifyApproval,
  decideApproval
} from './server-fact-approve-guard'
import type { SnapshotLint } from './server-fact-hook'

const SCRIPT = path.join(import.meta.dirname, 'server-fact-approve-guard.ts')
const PANEL = 'src/platform/workspace/composables/usePanel.ts'

const inputFiles: Record<string, string> = {
  'approve.json': '{ "event": "APPROVE", "body": "ok" }',
  'comment.json': '{ "event": "COMMENT", "body": "do not APPROVE yet" }'
}
const readInput = (file: string) => inputFiles[file] ?? ''

describe('classifyApproval', () => {
  it.for<[string, Approval | undefined]>([
    ['gh pr review 123 --approve', { pr: '123', repo: undefined }],
    ['gh pr review 123 -a -b ok', { pr: '123', repo: undefined }],
    [
      'gh pr review --approve --repo Comfy-Org/ComfyUI_frontend 7',
      { pr: '7', repo: 'Comfy-Org/ComfyUI_frontend' }
    ],
    [
      'gh pr review https://github.com/Comfy-Org/ComfyUI_frontend/pull/9 --approve',
      {
        pr: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/9',
        repo: 'Comfy-Org/ComfyUI_frontend'
      }
    ],
    [
      'cd app && GH_PAGER= gh pr review 5 --approve --body "a && b"',
      { pr: '5', repo: undefined }
    ],
    ['gh pr review --approve', { pr: undefined, repo: undefined }],
    ['gh pr review 123 --comment -b x', undefined],
    ['gh pr review 123 --request-changes', undefined],
    ['gh pr review 123 --comment -b "--approve"', undefined],
    [
      'gh api repos/Comfy-Org/ComfyUI_frontend/pulls/1/reviews -f event=APPROVE',
      { pr: '1', repo: 'Comfy-Org/ComfyUI_frontend' }
    ],
    [
      'gh api -X POST /repos/Comfy-Org/ComfyUI_frontend/pulls/2/reviews --input approve.json',
      { pr: '2', repo: 'Comfy-Org/ComfyUI_frontend' }
    ],
    [
      'gh api repos/{owner}/{repo}/pulls/3/reviews/44/events -F event=APPROVE',
      { pr: '3', repo: undefined }
    ],
    [
      'gh api repos/Comfy-Org/ComfyUI_frontend/pulls/2/reviews --input comment.json',
      undefined
    ],
    [
      'gh api repos/Comfy-Org/ComfyUI_frontend/pulls/2/reviews -f event=COMMENT -f body=APPROVE',
      undefined
    ],
    [
      'gh api repos/Comfy-Org/ComfyUI_frontend/pulls/2/comments -f event=APPROVE',
      undefined
    ],
    ['gh pr view 1', undefined],
    ['echo gh pr review 1 --approve', undefined],
    ['gh pr review 1 --approve -R other/repo', { pr: '1', repo: 'other/repo' }]
  ])('%s', ([command, expected]) => {
    expect(classifyApproval(command, readInput)).toEqual(expected)
  })
})

describe('approvalDecision', () => {
  const diff = [
    `diff --git a/${PANEL} b/${PANEL}`,
    `--- a/${PANEL}`,
    `+++ b/${PANEL}`,
    '@@ -2 +2 @@',
    'diff --git a/src/a.test.ts b/src/a.test.ts',
    '+++ b/src/a.test.ts',
    '@@ -1 +1 @@'
  ].join('\n')
  const head = [
    "const isOwner = role === 'owner'",
    'const canInvite = canInviteMembers.value || isOwner',
    ''
  ].join('\n')

  function diagnosticOnLine(line: number, message: string) {
    const offset = head
      .split('\n')
      .slice(0, line - 1)
      .reduce((sum, text) => sum + text.length + 1, 0)
    return {
      filename: PANEL,
      message,
      labels: [{ span: { offset, length: 5, line } }]
    }
  }

  const lint: SnapshotLint = () => ({
    ok: true,
    diagnostics: [
      diagnosticOnLine(1, 'role literal'),
      diagnosticOnLine(2, 'combined')
    ]
  })

  it('blocks on findings in changed lines of gated files only', () => {
    const decision = approvalDecision(diff, () => head, lint)

    expect(decision).toEqual({
      kind: 'block',
      report: expect.stringMatching(
        new RegExp(
          `^server-fact: ${PANEL}:2 combined\nApproval blocked until these are resolved.\n`
        )
      )
    })
  })

  it('lints only the gated files the PR changed', () => {
    const linted: string[][] = []
    approvalDecision(
      diff,
      () => head,
      (contents) => {
        linted.push([...contents.keys()])
        return { ok: true, diagnostics: [] }
      }
    )

    expect(linted).toEqual([[PANEL]])
  })

  it('allows when no gated file changed, without linting', () => {
    const decision = approvalDecision(
      'diff --git a/docs/x.md b/docs/x.md\n+++ b/docs/x.md\n@@ -1 +1 @@',
      () => head,
      () => ({ ok: false, detail: 'lint must not run' })
    )

    expect(decision).toEqual({ kind: 'allow' })
  })

  it('fails open when lint cannot run', () => {
    expect(
      approvalDecision(
        diff,
        () => head,
        () => ({ ok: false, detail: 'boom' })
      )
    ).toEqual({ kind: 'warn', warning: 'boom' })
  })
})

describe('decideApproval', () => {
  it.for([
    'gh pr review 1 --approve --repo someone/else',
    'gh pr review 1 --comment -b looks-good',
    'git status'
  ])('allows %s without consulting GitHub', (command) => {
    expect(
      decideApproval({ tool_name: 'Bash', tool_input: { command } }, () => ({
        ok: false,
        detail: 'lint must not run'
      }))
    ).toEqual({ kind: 'allow' })
  })
})

describe('server-fact-approve-guard hook', () => {
  it('exits 0 silently for an approval in another repository', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', SCRIPT], {
      cwd: path.resolve(import.meta.dirname, '../..'),
      input: JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command: 'gh pr review 1 --approve -R someone/else' }
      }),
      encoding: 'utf8'
    })

    expect({ status: result.status, stderr: result.stderr }).toEqual({
      status: 0,
      stderr: ''
    })
  })
})
