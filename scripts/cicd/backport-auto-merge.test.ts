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

// Stands in for `gh`: `pr view` answers from FAKE_PR, `api .../reviews` from
// FAKE_REVIEWS, `pr merge` is recorded and marks the PR merged.
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
      */reviews) cat "$FAKE_REVIEWS" ;;
      */comments) echo '[]' ;;
      *) echo "unexpected gh api call: $2" >&2; exit 2 ;;
    esac ;;
  *) echo "unexpected gh call: $*" >&2; exit 2 ;;
esac
`

function runMerge(reviews: Array<{ state: string; commit_id: string }>) {
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
      reviews.map((review) => ({ user: { login: 'reviewer' }, ...review }))
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
  })

  it('does not merge when the only approval is on an older commit', () => {
    const { result, merges } = runMerge([{ state: 'APPROVED', commit_id: OLD }])

    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(merges).toHaveLength(0)
    expect(result.stdout).toContain('no approval at head')
  })
})
