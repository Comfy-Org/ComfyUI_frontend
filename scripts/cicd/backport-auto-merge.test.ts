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
  name?: string
  run?: string
}

interface Workflow {
  jobs?: Partial<Record<string, { steps?: WorkflowStep[] }>>
}

const workflow = parse(
  readFileSync('.github/workflows/backport-auto-merge.yaml', 'utf8')
) as Workflow
const mergeScript =
  workflow.jobs?.merge?.steps?.find(
    (step) => step.name === 'Merge eligible backport PRs'
  )?.run ?? ''

const HEAD = 'b'.repeat(40)
const OLD = 'a'.repeat(40)

const fakeGh = `#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "$FAKE_CALLS"
case "$1 $2" in
  "pr view")
    jq_filter=''
    while [ $# -gt 0 ]; do
      case "$1" in --jq) jq_filter="$2"; shift 2 ;; *) shift ;; esac
    done
    if [ -n "$jq_filter" ]; then jq -r "$jq_filter" "$FAKE_PR"; else cat "$FAKE_PR"; fi ;;
  "pr merge")
    jq '.state = "MERGED"' "$FAKE_PR" > "$FAKE_PR.tmp" && mv "$FAKE_PR.tmp" "$FAKE_PR" ;;
  "pr comment") : ;;
  api\\ *)
    case "$2" in
      */reviews)
        [ -z "\${FAKE_REVIEWS_FAIL:-}" ] || { echo 'API rate limit exceeded (HTTP 403)' >&2; exit 1; }
        cat "$FAKE_REVIEWS" ;;
      */comments) echo '[]' ;;
      *) echo "unexpected gh api call: $2" >&2; exit 2 ;;
    esac ;;
  *) echo "unexpected gh call: $*" >&2; exit 2 ;;
esac
`

interface Review {
  state: string
  commit_id: string
  login?: string
  author_association?: string
}

function runMerge(reviews: Review[], { reviewsFail = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'backport-auto-merge-'))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  const calls = join(directory, 'calls')
  writeFileSync(calls, '')
  writeFileSync(join(directory, 'gh'), fakeGh)
  chmodSync(join(directory, 'gh'), 0o755)
  writeFileSync(
    join(directory, 'pr.json'),
    JSON.stringify({
      number: 22422,
      state: 'OPEN',
      isDraft: false,
      labels: [{ name: 'backport' }],
      baseRefName: 'core/1.59',
      reviewDecision: 'APPROVED',
      mergeStateStatus: 'CLEAN',
      headRefOid: HEAD
    })
  )
  writeFileSync(
    join(directory, 'reviews.json'),
    JSON.stringify(
      reviews.map(
        ({ login = 'reviewer', author_association = 'MEMBER', ...review }) => ({
          user: { login },
          author_association,
          ...review
        })
      )
    )
  )
  const result = spawnSync('bash', ['-c', mergeScript], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CANDIDATES: '22422',
      FAKE_CALLS: calls,
      FAKE_PR: join(directory, 'pr.json'),
      FAKE_REVIEWS: join(directory, 'reviews.json'),
      FAKE_REVIEWS_FAIL: reviewsFail ? '1' : '',
      GH_REPO: 'Comfy-Org/ComfyUI_frontend',
      MERGE_TOKEN: 'merge-token',
      PATH: `${directory}:${process.env.PATH}`,
      READ_TOKEN: 'read-token'
    }
  })
  const merges = readFileSync(calls, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('pr merge'))
  return { result, merges }
}

describe('backport auto-merge', () => {
  it('merges a ready backport approved at its current head', () => {
    const { result, merges } = runMerge([
      { state: 'APPROVED', commit_id: HEAD }
    ])

    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(merges).toHaveLength(1)
    expect(merges[0]).toContain(`--match-head-commit ${HEAD}`)
  })

  it('does not merge when the only approval is on an older commit', () => {
    const { result, merges } = runMerge([{ state: 'APPROVED', commit_id: OLD }])

    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(merges).toHaveLength(0)
    expect(result.stdout).toContain('no approval at head')
  })

  it('ignores an approval at head from an account without write access', () => {
    const { merges } = runMerge([
      { state: 'APPROVED', commit_id: OLD, login: 'maintainer' },
      {
        state: 'APPROVED',
        commit_id: HEAD,
        login: 'outsider',
        author_association: 'NONE'
      }
    ])

    expect(merges).toHaveLength(0)
  })

  it('uses only the latest review from each reviewer', () => {
    const { merges } = runMerge([
      { state: 'APPROVED', commit_id: HEAD, login: 'first' },
      { state: 'DISMISSED', commit_id: HEAD, login: 'first' },
      { state: 'COMMENTED', commit_id: HEAD, login: 'first' },
      { state: 'APPROVED', commit_id: OLD, login: 'second' }
    ])

    expect(merges).toHaveLength(0)
  })

  it('reports a failed review lookup instead of waiting silently', () => {
    const { result, merges } = runMerge([], { reviewsFail: true })

    expect(result.status).toBe(0)
    expect(merges).toHaveLength(0)
    expect(result.stdout).toContain('Could not read reviews')
    expect(result.stdout).toContain('API rate limit exceeded')
  })
})
