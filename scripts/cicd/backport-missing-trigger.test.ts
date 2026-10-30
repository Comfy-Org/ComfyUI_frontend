import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'
import { parse } from 'yaml'

interface WorkflowStep {
  run?: string
  env?: Record<string, string>
}

interface WorkflowJob {
  env?: Record<string, string>
  steps?: WorkflowStep[]
}

interface Workflow {
  jobs?: Partial<Record<string, WorkflowJob>>
}

const workflow = parse(
  readFileSync('.github/workflows/pr-backport.yaml', 'utf8')
) as Workflow
const warnStep = workflow.jobs?.['warn-missing-needs-backport']?.steps?.[0]
const warnScript = warnStep?.run ?? ''

const fakeGh = `#!/usr/bin/env bash
set -euo pipefail
shift
endpoint='' filter='.' method=GET body=''
while [ $# -gt 0 ]; do
  case "$1" in
    --jq) filter="$2"; shift 2 ;;
    --method) method="$2"; shift 2 ;;
    -f) body="\${2#body=}"; shift 2 ;;
    --paginate|--silent) shift ;;
    *) endpoint="$1"; shift ;;
  esac
done
case "$method $endpoint" in
  POST\\ *)
    [ -z "\${FAKE_LOCKED:-}" ] || { echo 'Issue is locked' >&2; exit 1; }
    jq -nc --arg body "$body" '{user: {login: "github-actions[bot]"}, body: $body}' >> "$FAKE_COMMENTS" ;;
  *"/labels") jq -r "$filter" "$FAKE_LABELS" ;;
  *"/comments") cat "$FAKE_COMMENTS" | jq -rs "$filter" ;;
  *"/pulls?"*)
    base='' head="\${endpoint#*head=}" head="\${head%%&*}"
    case "$endpoint" in *base=*) base="\${endpoint#*base=}" base="\${base%%&*}" ;; esac
    awk -v b="$base" -v h="$head" '("Comfy-Org:" $2) == h && (b == "" || $1 == b) { print ($3 == "" ? "merged" : $3) }' "$FAKE_BACKPORTS" |
      jq -Rs 'split("\\n") | map(select(. != "")) | map({state: (if . == "open" then "open" else "closed" end), merged_at: (if . == "merged" then "2026-10-01T00:00:00Z" else null end)})' |
      jq -r "$filter" ;;
  *) echo "unexpected gh call: $method $endpoint" >&2; exit 2 ;;
esac
`

interface PrSetup {
  labels: string[]
  backports?: Array<{
    base: string
    head: string
    state?: 'open' | 'closed' | 'merged'
  }>
  comments?: Array<{ author: string; body: string }>
  locked?: boolean
}

function createPr({
  labels,
  backports = [],
  comments: existingComments = [],
  locked = false
}: PrSetup) {
  const directory = mkdtempSync(join(tmpdir(), 'backport-missing-trigger-'))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  const comments = join(directory, 'comments')
  writeFileSync(join(directory, 'gh'), fakeGh)
  chmodSync(join(directory, 'gh'), 0o755)
  writeFileSync(
    join(directory, 'labels.json'),
    JSON.stringify(labels.map((name) => ({ name })))
  )
  writeFileSync(
    join(directory, 'backports'),
    backports
      .map(({ base, head, state = 'merged' }) => `${base} ${head} ${state}`)
      .join('\n')
  )
  writeFileSync(
    comments,
    existingComments
      .map(
        ({ author, body }) =>
          `${JSON.stringify({ user: { login: author }, body })}\n`
      )
      .join('')
  )
  const initialCount = existingComments.length

  function botComments() {
    return readFileSync(comments, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(initialCount)
      .map((line) => (JSON.parse(line) as { body: string }).body)
  }

  return {
    runWarning: () =>
      spawnSync('bash', ['-c', warnScript], {
        encoding: 'utf8',
        env: {
          ...process.env,
          FAKE_BACKPORTS: join(directory, 'backports'),
          FAKE_COMMENTS: comments,
          FAKE_LABELS: join(directory, 'labels.json'),
          FAKE_LOCKED: locked ? '1' : '',
          GH_REPO: 'Comfy-Org/ComfyUI_frontend',
          PATH: `${directory}:${process.env.PATH}`,
          PR_NUMBER: '21241'
        }
      }),
    postedComments: botComments,
    setLabels: (next: string[]) =>
      writeFileSync(
        join(directory, 'labels.json'),
        JSON.stringify(next.map((name) => ({ name })))
      )
  }
}

describe('backport warning for release labels without needs-backport', () => {
  it('posts one comment naming the release labels and how to start the backport', () => {
    const pr = createPr({ labels: ['core/1.57', 'cloud/1.57', 'bug'] })

    const result = pr.runWarning()

    expect(result.status).toBe(0)
    expect(pr.postedComments()).toHaveLength(1)
    const [comment] = pr.postedComments()
    expect(comment).toContain('`core/1.57` `cloud/1.57`')
    expect(comment).toContain('add the `needs-backport` label')
    expect(comment).not.toContain('`bug`')
  })

  it('does not post again on a later label event, but warns about a newly added release label', () => {
    const pr = createPr({ labels: ['core/1.57'] })

    pr.runWarning()
    pr.runWarning()
    pr.setLabels(['core/1.57', 'cloud/1.58'])
    pr.runWarning()

    const posted = pr.postedComments()
    expect(posted).toHaveLength(2)
    expect(posted[1]).toContain('`cloud/1.58`')
    expect(posted[1]).not.toContain('`core/1.57`')
  })

  it('leaves out targets that already have a backport PR', () => {
    const pr = createPr({
      labels: ['core/1.57', 'cloud/1.57'],
      backports: [{ base: 'core/1.57', head: 'backport-21241-to-core-1.57' }]
    })

    pr.runWarning()

    const [comment] = pr.postedComments()
    expect(comment).toContain('`cloud/1.57`')
    expect(comment).not.toContain('`core/1.57`')
  })

  it('still warns when the matching backport branch targets a different release', () => {
    const pr = createPr({
      labels: ['core/1.57'],
      backports: [{ base: 'core/1.56', head: 'backport-21241-to-core-1.57' }]
    })

    pr.runWarning()

    expect(pr.postedComments()).toHaveLength(1)
  })

  it('still warns when the only backport PR was closed without merging', () => {
    const pr = createPr({
      labels: ['core/1.57'],
      backports: [
        {
          base: 'core/1.57',
          head: 'backport-21241-to-core-1.57',
          state: 'closed'
        }
      ]
    })

    pr.runWarning()

    expect(pr.postedComments()).toHaveLength(1)
    expect(pr.postedComments()[0]).toContain('`core/1.57`')
  })

  it.for<[string, PrSetup]>([
    ['no release label', { labels: ['bug'] }],
    [
      'only labels outside the core/X.Y or cloud/X.Y form',
      { labels: ['1.57', 'branch:release/hotfix', 'core/1.57-rc'] }
    ],
    [
      'needs-backport was added after the event fired',
      { labels: ['core/1.57', 'needs-backport'] }
    ],
    [
      'the backport PR is still open',
      {
        labels: ['core/1.57'],
        backports: [
          {
            base: 'core/1.57',
            head: 'backport-21241-to-core-1.57',
            state: 'open'
          }
        ]
      }
    ],
    [
      'every release label is already backported',
      {
        labels: ['core/1.57'],
        backports: [{ base: 'core/1.57', head: 'backport-21241-to-core-1.57' }]
      }
    ]
  ])('stays silent when %s', ([, setup]) => {
    const pr = createPr(setup)

    const result = pr.runWarning()

    expect(result.status).toBe(0)
    expect(pr.postedComments()).toHaveLength(0)
  })

  it('still warns when someone other than the workflow posted the marker', () => {
    const pr = createPr({
      labels: ['core/1.57'],
      comments: [
        {
          author: 'someone',
          body: '<!-- pr-backport:missing-needs-backport core/1.57 -->'
        }
      ]
    })

    pr.runWarning()

    expect(pr.postedComments()).toHaveLength(1)
  })

  it('reports a rejected comment on a locked PR as a warning without failing', () => {
    const pr = createPr({ labels: ['core/1.57'], locked: true })

    const result = pr.runWarning()

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('::warning::')
    expect(result.stdout).toContain('core/1.57')
  })

  it('posts with the same token the backport job uses, since the auto-provided one is refused', () => {
    expect(warnStep?.env?.GH_TOKEN).toBe(workflow.jobs?.backport?.env?.GH_TOKEN)
  })
})
