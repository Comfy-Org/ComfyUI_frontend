import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeAll, describe, expect, it, onTestFinished } from 'vitest'
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

const forceRerunExpression =
  /^\$\{\{ github\.event_name == '([a-z_]+)' && inputs\.force_rerun \|\| 'false' \}\}$/.exec(
    commentEnv.FORCE_RERUN
  )
if (!forceRerunExpression) {
  throw new Error(
    `unexpected FORCE_RERUN expression in pr-backport.yaml: ${commentEnv.FORCE_RERUN}`
  )
}
const forceRerunEvent = forceRerunExpression[1]
const evaluateForceRerun = (eventName: string, forceRerunInput: boolean) =>
  eventName === forceRerunEvent && forceRerunInput ? 'true' : 'false'

beforeAll(() => {
  const missing = ['envsubst', 'jq'].filter(
    (tool) => spawnSync('bash', ['-c', `command -v ${tool}`]).status !== 0
  )
  if (missing.length > 0)
    throw new Error(
      `backport conflict comment tests need ${missing.join(' and ')} on PATH (envsubst ships in gettext-base)`
    )
})

const botLogin = 'comfy-backport-bot'
const firstMergeCommit = 'a'.repeat(40)
const secondMergeCommit = 'b'.repeat(40)
const firstTargetHead = 'c'.repeat(40)
const secondTargetHead = 'd'.repeat(40)
const coreConflict = 'core/1.56:conflicts:src/a.ts,src/b.ts'
const cloudConflict = 'cloud/1.56:conflicts:src/a.ts'

const fakeGh = `#!/usr/bin/env bash
set -euo pipefail
record() {
  jq -cn --arg login "\${FAKE_LOGIN}" --arg title "$1" --arg body "$2" \\
    '{user: {login: $login}, title: (if $title == "" then null else $title end), body: $body}'
}
case "$1 $2" in
  "api user")
    [[ -n "\${FAKE_LOGIN}" ]] || { echo 'gh: HTTP 403' >&2; exit 1; }
    echo "\${FAKE_LOGIN}"
    ;;
  "api --paginate")
    [[ "\${FAKE_READ}" == ok ]] || { echo 'gh: HTTP 503' >&2; exit 1; }
    case "$3" in
      */comments) file=comments.jsonl ;;
      *) file=issues.jsonl ;;
    esac
    { cat "\${FAKE_DIR}/\${file}" 2>/dev/null || true; } | jq -s .
    ;;
  "pr comment")
    [[ "\${FAKE_PR_LOCKED}" != true ]] || { echo 'gh: issue is locked' >&2; exit 1; }
    record "" "$5" >> "\${FAKE_DIR}/comments.jsonl"
    ;;
  "issue create")
    record "$4" "$6" >> "\${FAKE_DIR}/issues.jsonl"
    ;;
  "pr view")
    [[ "$3" == "\${FAKE_PR_NUMBER}" && "$4 $5" == "--json author,mergeCommit" ]] || {
      echo "unexpected gh pr view invocation: $*" >&2; exit 64; }
    jq -cn --arg oid "\${FAKE_MERGE_COMMIT}" '{author: {login: "pr-view-author"}, mergeCommit: {oid: $oid}}'
    ;;
  "pr list") ;;
  *) echo "unexpected gh invocation: $*" >&2; exit 64 ;;
esac
`

const fakeGit = `#!/usr/bin/env bash
[[ "$1" == rev-parse ]] || { echo "unexpected git invocation: $*" >&2; exit 64; }
echo "\${FAKE_TARGET_HEAD}"
`

function createSandbox() {
  const directory = mkdtempSync(join(tmpdir(), 'backport-conflict-comment-'))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  for (const [name, script] of [
    ['gh', fakeGh],
    ['git', fakeGit]
  ]) {
    writeFileSync(join(directory, name), script)
    chmodSync(join(directory, name), 0o755)
  }
  return directory
}

interface Run {
  event?: 'pull_request_target' | 'workflow_dispatch'
  mergeCommit?: string
  targetHead?: string
  failed?: string
  forceRerun?: boolean
  commentsRead?: 'ok' | 'error'
  login?: string
  prLocked?: boolean
}

function reportConflict(
  sandbox: string,
  {
    event = 'pull_request_target',
    mergeCommit = firstMergeCommit,
    targetHead = firstTargetHead,
    failed = coreConflict,
    forceRerun = false,
    commentsRead = 'ok',
    login = botLogin,
    prLocked = false
  }: Run = {}
) {
  const eventPath = join(sandbox, 'event.json')
  writeFileSync(
    eventPath,
    JSON.stringify(
      event === 'workflow_dispatch'
        ? { inputs: { pr_number: '21078', force_rerun: String(forceRerun) } }
        : {
            pull_request: {
              number: 21078,
              user: { login: 'author' },
              merge_commit_sha: mergeCommit
            }
          }
    )
  )
  const script = commentRun
    .replaceAll('${{ github.event_name }}', event)
    .replaceAll('${{ inputs.pr_number }}', '21078')
    .replaceAll('${{ steps.backport.outputs.failed }}', failed)

  const result = spawnSync('bash', ['-e', '-c', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      BACKPORT_AGENT_PROMPT_TEMPLATE: commentEnv.BACKPORT_AGENT_PROMPT_TEMPLATE,
      COMMENT_BODY_TEMPLATE: commentEnv.COMMENT_BODY_TEMPLATE,
      FAKE_DIR: sandbox,
      FAKE_MERGE_COMMIT: mergeCommit,
      FAKE_PR_NUMBER: '21078',
      FAKE_LOGIN: login,
      FAKE_PR_LOCKED: String(prLocked),
      FAKE_READ: commentsRead,
      FAKE_TARGET_HEAD: targetHead,
      FORCE_RERUN: evaluateForceRerun(event, forceRerun),
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
      GITHUB_SERVER_URL: 'https://github.com',
      PATH: `${sandbox}:${process.env.PATH}`
    }
  })
  expect(result.status).toBe(0)
}

const readRecords = (sandbox: string, file: string) =>
  existsSync(join(sandbox, file))
    ? readFileSync(join(sandbox, file), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { body: string })
    : []

const postedReports = (sandbox: string) =>
  [
    ...readRecords(sandbox, 'comments.jsonl'),
    ...readRecords(sandbox, 'issues.jsonl')
  ]
    .map(({ body }) => body)
    .filter((body) => body.includes('Backport to `'))

describe('backport conflict comment', () => {
  it('marks the conflict comment with its target, merge commit and target head', () => {
    const sandbox = createSandbox()

    reportConflict(sandbox)

    const reports = postedReports(sandbox)
    expect(reports).toHaveLength(1)
    expect(reports[0]).toContain('Backport to `core/1.56` failed')
    expect(reports[0]).toContain(
      `<!-- backport-conflict:core/1.56:${firstMergeCommit}:${firstTargetHead} -->`
    )
  })

  it.for<{ scenario: string; first?: Run; second: Run; expected: number }>([
    {
      scenario: 'a later labeled event for the same merge commit',
      second: {},
      expected: 1
    },
    {
      scenario: 'a later labeled event on a locked PR',
      first: { prLocked: true },
      second: { prLocked: true },
      expected: 1
    },
    {
      scenario: 'a new merge commit',
      second: { mergeCommit: secondMergeCommit },
      expected: 2
    },
    {
      scenario: 'a moved target branch',
      second: { targetHead: secondTargetHead },
      expected: 2
    },
    {
      scenario: 'a manual dispatch with force_rerun',
      second: { event: 'workflow_dispatch', forceRerun: true },
      expected: 2
    },
    {
      scenario: 'a manual dispatch without force_rerun',
      second: { event: 'workflow_dispatch' },
      expected: 1
    },
    {
      scenario: 'force_rerun set outside a manual dispatch',
      second: { forceRerun: true },
      expected: 1
    },
    {
      scenario: 'a failed read of the existing comments',
      second: { commentsRead: 'error' },
      expected: 2
    },
    {
      scenario: 'an unresolvable posting identity',
      second: { login: '' },
      expected: 2
    },
    {
      scenario: 'the marker posted by someone else',
      first: { login: 'someone-else' },
      second: {},
      expected: 2
    }
  ])(
    'posts $expected conflict report(s) after $scenario',
    ({ first, second, expected }) => {
      const sandbox = createSandbox()

      reportConflict(sandbox, first)
      reportConflict(sandbox, second)

      expect(postedReports(sandbox)).toHaveLength(expected)
    }
  )

  it('reads the author and merge commit from the PR on a manual dispatch', () => {
    const sandbox = createSandbox()

    reportConflict(sandbox, {
      event: 'workflow_dispatch',
      forceRerun: true,
      mergeCommit: secondMergeCommit
    })

    const reports = postedReports(sandbox)
    expect(reports).toHaveLength(1)
    expect(reports[0]).toContain(
      `<!-- backport-conflict:core/1.56:${secondMergeCommit}:${firstTargetHead} -->`
    )
    expect(reports[0]).toContain('cc @pr-view-author')
  })

  it('reports the same merge commit once per target', () => {
    const sandbox = createSandbox()

    reportConflict(sandbox, { failed: `${coreConflict} ${cloudConflict}` })
    reportConflict(sandbox, { failed: coreConflict })
    reportConflict(sandbox, { failed: cloudConflict })

    const reports = postedReports(sandbox)
    expect(reports).toHaveLength(2)
    expect(reports[0]).toContain('Backport to `core/1.56` failed')
    expect(reports[1]).toContain('Backport to `cloud/1.56` failed')
  })
})
