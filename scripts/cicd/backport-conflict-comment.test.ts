import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  name?: string
  run?: string
  env?: Record<string, string>
}

interface Workflow {
  jobs?: Record<string, { steps?: WorkflowStep[] }>
}

const workflow = parse(
  readFileSync('.github/workflows/pr-backport.yaml', 'utf8')
) as Workflow
const commentStep = Object.values(workflow.jobs ?? {})
  .flatMap((job) => job.steps ?? [])
  .find((step) => step.name === 'Comment on failures')
if (!commentStep?.run || !commentStep.env) {
  throw new Error('pr-backport.yaml must define the "Comment on failures" step')
}
const { run: commentRun, env: commentEnv } = commentStep

const firstMergeCommit = 'a'.repeat(40)
const secondMergeCommit = 'b'.repeat(40)
const separator = '\n---END-OF-COMMENT---\n'

const fakeGh = `#!/usr/bin/env bash
set -euo pipefail
case "$1 $2" in
  "api --paginate")
    [[ "\${FAKE_COMMENTS_READ:-ok}" == ok ]] || { echo 'gh: HTTP 503' >&2; exit 1; }
    cat "\${FAKE_COMMENTS_FILE:?}" 2>/dev/null || true
    ;;
  "pr comment")
    printf '%s%s' "$5" "\${FAKE_SEPARATOR:?}" >> "\${FAKE_COMMENTS_FILE:?}"
    ;;
  "pr list") ;;
  *) echo "unexpected gh invocation: $*" >&2; exit 64 ;;
esac
`

function createSandbox() {
  const directory = mkdtempSync(join(tmpdir(), 'backport-conflict-comment-'))
  writeFileSync(join(directory, 'gh'), fakeGh)
  chmodSync(join(directory, 'gh'), 0o755)
  return {
    directory,
    comments: join(directory, 'comments'),
    event: join(directory, 'event.json')
  }
}

function reportConflict(
  sandbox: ReturnType<typeof createSandbox>,
  {
    mergeCommit,
    forceRerun = false,
    commentsRead = 'ok'
  }: { mergeCommit: string; forceRerun?: boolean; commentsRead?: string }
) {
  writeFileSync(
    sandbox.event,
    JSON.stringify({
      pull_request: {
        number: 21078,
        user: { login: 'author' },
        merge_commit_sha: mergeCommit
      }
    })
  )
  const script = commentRun
    .replaceAll('${{ github.event_name }}', 'pull_request_target')
    .replaceAll('${{ inputs.pr_number }}', '21078')
    .replaceAll(
      '${{ steps.backport.outputs.failed }}',
      'core/1.56:conflicts:src/a.ts,src/b.ts'
    )

  const result = spawnSync('bash', ['-e', '-c', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      BACKPORT_AGENT_PROMPT_TEMPLATE: commentEnv.BACKPORT_AGENT_PROMPT_TEMPLATE,
      COMMENT_BODY_TEMPLATE: commentEnv.COMMENT_BODY_TEMPLATE,
      FAKE_COMMENTS_FILE: sandbox.comments,
      FAKE_COMMENTS_READ: commentsRead,
      FAKE_SEPARATOR: separator,
      FORCE_RERUN: String(forceRerun),
      GITHUB_EVENT_PATH: sandbox.event,
      GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
      GITHUB_SERVER_URL: 'https://github.com',
      PATH: `${sandbox.directory}:${process.env.PATH}`
    }
  })
  expect(result.status).toBe(0)
}

const postedComments = (sandbox: ReturnType<typeof createSandbox>) =>
  existsSync(sandbox.comments)
    ? readFileSync(sandbox.comments, 'utf8').split(separator).filter(Boolean)
    : []

describe('backport conflict comment', () => {
  it('marks the conflict comment with its target and merge commit', () => {
    const sandbox = createSandbox()

    reportConflict(sandbox, { mergeCommit: firstMergeCommit })

    const comments = postedComments(sandbox)
    expect(comments).toHaveLength(1)
    expect(comments[0]).toContain('Backport to `core/1.56` failed')
    expect(comments[0]).toContain(
      `<!-- backport-conflict:core/1.56:${firstMergeCommit} -->`
    )
  })

  it.for([
    {
      scenario: 'a later labeled event for the same merge commit',
      second: { mergeCommit: firstMergeCommit },
      expected: 1
    },
    {
      scenario: 'a new merge commit',
      second: { mergeCommit: secondMergeCommit },
      expected: 2
    },
    {
      scenario: 'a manual force rerun',
      second: { mergeCommit: firstMergeCommit, forceRerun: true },
      expected: 2
    },
    {
      scenario: 'a failed read of the existing comments',
      second: { mergeCommit: firstMergeCommit, commentsRead: 'error' },
      expected: 2
    }
  ])(
    'posts $expected conflict comment(s) after $scenario',
    ({ second, expected }) => {
      const sandbox = createSandbox()

      reportConflict(sandbox, { mergeCommit: firstMergeCommit })
      reportConflict(sandbox, second)

      expect(postedComments(sandbox)).toHaveLength(expected)
    }
  )
})
