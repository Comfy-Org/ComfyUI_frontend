import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface WorkflowJob {
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean }
  if?: string
  steps?: Array<{
    env?: Record<string, string>
    id?: string
    uses?: string
    with?: Record<string, string | boolean>
  }>
  'timeout-minutes'?: number
}

interface Workflow {
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean }
  jobs?: Record<string, WorkflowJob>
  on?: {
    push?: { branches?: string[]; 'tags-ignore'?: string[] }
  }
}

const workflow = parse(
  readFileSync('.github/workflows/cloud-backport-tag.yaml', 'utf8')
) as Workflow
const dispatchWorkflowSource = readFileSync(
  '.github/workflows/cloud-dispatch-build.yaml',
  'utf8'
)
const dispatchWorkflow = parse(dispatchWorkflowSource) as Workflow
const targetSha = 'a'.repeat(40)
const otherSha = 'b'.repeat(40)
const tagObjectSha = 'c'.repeat(40)

const fakeGh = `#!/usr/bin/env bash
set -euo pipefail
args="$*"
count_file="\${FAKE_GH_COUNT_FILE:?}"
count=$(cat "$count_file" 2>/dev/null || echo 0)

if [[ "$args" == *"compare/"* ]]; then
  printf '%s\\n' "\${FAKE_CONTAINMENT:-behind}"
elif [[ "$args" == *"contents/package.json"* ]]; then
  printf '{"version":"1.54.16"}\\n'
elif [[ "$args" == *"git/ref/heads/"* ]]; then
  printf '%s\\n' "\${TARGET_SHA}"
elif [[ "$args" == *"git/tags/"* ]]; then
  printf 'commit\\t%s\\n' "\${TARGET_SHA}"
elif [[ "$args" == *"git/ref/tags/"* ]]; then
  count=$((count + 1)); printf '%s' "$count" > "$count_file"
  case "\${FAKE_SCENARIO:?}" in
    missing) echo 'gh: Not Found (HTTP 404)' >&2; exit 1 ;;
    same) printf 'commit\\t%s\\n' "\${TARGET_SHA}" ;;
    different) printf 'commit\\t%s\\n' "\${OTHER_SHA}" ;;
    annotated) printf 'tag\\t%s\\n' "\${TAG_OBJECT_SHA}" ;;
    api-error) echo 'gh: service unavailable (HTTP 503)' >&2; exit 1 ;;
    race)
      if [[ "$count" == 1 ]]; then echo 'gh: Not Found (HTTP 404)' >&2; exit 1; fi
      printf 'commit\\t%s\\n' "\${TARGET_SHA}"
      ;;
  esac
elif [[ "$args" == *"--method POST"* ]]; then
  if [[ "\${FAKE_SCENARIO:?}" == race ]]; then
    echo 'gh: Reference already exists (HTTP 422)' >&2
    exit 1
  fi
  printf 'refs/tags/cloud/v1.54.16\\n'
else
  echo "unexpected gh invocation: $args" >&2
  exit 64
fi
`

function runTagScript(
  scenario: string,
  options: {
    containment?: string
    event?: string
    sha?: string
    token?: string
  } = {}
) {
  const directory = mkdtempSync(join(tmpdir(), 'cloud-backport-tag-'))
  const binary = join(directory, 'gh')
  const output = join(directory, 'output')
  const summary = join(directory, 'summary')
  const count = join(directory, 'count')
  writeFileSync(binary, fakeGh)
  chmodSync(binary, 0o755)

  return spawnSync('bash', ['scripts/cicd/cloud-backport-tag.sh'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      BRANCH: 'cloud/1.54',
      EVENT_NAME: options.event ?? 'workflow_dispatch',
      GH_TOKEN: options.token ?? 'test-token',
      FAKE_CONTAINMENT: options.containment ?? 'behind',
      FAKE_GH_COUNT_FILE: count,
      FAKE_SCENARIO: scenario,
      GITHUB_OUTPUT: output,
      GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
      GITHUB_STEP_SUMMARY: summary,
      PATH: `${directory}:${process.env.PATH}`,
      SHA: options.sha ?? targetSha,
      TAG_OBJECT_SHA: tagObjectSha,
      TARGET_SHA: targetSha,
      OTHER_SHA: otherSha
    }
  })
}

describe('cloud backport tag workflow', () => {
  it('dispatches branch pushes without dispatching tags or deleted branches', () => {
    expect(dispatchWorkflow.on?.push?.branches).toEqual(['**'])
    expect(dispatchWorkflow.on?.push?.['tags-ignore']).toEqual(['**'])
    const dispatchJob = dispatchWorkflow.jobs?.dispatch
    if (!dispatchJob) throw new Error('dispatch job is required')
    expect(dispatchJob.if).toContain(
      "github.event_name != 'push' || github.event.deleted == false"
    )
    expect(dispatchJob.if).toContain(
      'github.event.pull_request.head.repo.full_name == github.repository'
    )
    expect(dispatchJob.concurrency?.group).toBe(
      'cloud-dispatch-${{ github.event.pull_request.head.ref || github.ref_name }}'
    )
    expect(dispatchJob.concurrency?.['cancel-in-progress']).toBe(false)
    expect(dispatchJob['timeout-minutes']).toBe(10)
    expect(dispatchWorkflow.concurrency).toBeUndefined()
    expect(dispatchWorkflowSource).toContain(
      '[[ "${BRANCH}" =~ ^cloud/[0-9]+\\.[0-9]+$ ]]'
    )
    expect(dispatchWorkflowSource).toContain(
      'elif [[ "${BRANCH}" =~ ^cloud/[0-9] ]]'
    )
    expect(dispatchWorkflowSource).toContain(
      `Unrecognized cloud release branch '\${BRANCH}'; expected cloud/x.y`
    )
  })

  it('keeps every event distinct and bounds the API-only job', () => {
    expect(workflow.concurrency?.group).toContain(
      'github.event.pull_request.number'
    )
    expect(workflow.concurrency?.group).toContain('github.run_id')
    expect(workflow.concurrency?.['cancel-in-progress']).toBe(false)
    expect(workflow.jobs?.['create-tag']?.['timeout-minutes']).toBe(10)
    expect(workflow.jobs?.['create-tag']?.if).toBe(
      "(github.event_name == 'workflow_dispatch' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch)) || (github.event.pull_request.merged == true && contains(github.event.pull_request.labels.*.name, 'backport'))\n"
    )
    const steps = workflow.jobs?.['create-tag']?.steps
    const checkout = steps?.find((step) =>
      step.uses?.startsWith('actions/checkout')
    )
    const tagStep = steps?.find((step) => step.id === 'tag')
    expect(checkout?.with?.ref).toBe(
      '${{ github.event.repository.default_branch }}'
    )
    expect(tagStep?.env?.GH_TOKEN).toBe('${{ secrets.PR_GH_TOKEN }}')
  })

  it('fails closed when the release token is absent', () => {
    const result = runTagScript('same', { token: '' })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'PR_GH_TOKEN is required for cloud tag reconciliation'
    )
  })

  it('accepts existing same, different, and annotated tags without moving them', () => {
    for (const scenario of ['same', 'annotated']) {
      const result = runTagScript(scenario)
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('already exists at')
      expect(result.stdout).toContain('skipping')
    }

    const different = runTagScript('different')
    expect(different.status).toBe(0)
    expect(different.stdout).toContain('first release marker is preserved')
    expect(different.stdout).not.toContain('refs/tags/cloud/v1.54.16')
  })

  it('creates a missing lightweight tag through the refs API', () => {
    const result = runTagScript('missing')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('refs/tags/cloud/v1.54.16')
  })

  it('accepts the winner of a concurrent create race', () => {
    const result = runTagScript('race')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('already exists')
  })

  it('fails closed when the tag lookup has a real API error', () => {
    const result = runTagScript('api-error')
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('HTTP 503')
  })

  it('rejects a commit outside the selected release branch', () => {
    const result = runTagScript('missing', { containment: 'diverged' })
    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('is not contained')
  })

  it('normalizes a pasted manual SHA and rejects a missing PR merge SHA', () => {
    const manual = runTagScript('same', {
      sha: `  ${targetSha.toUpperCase()}\n`
    })
    expect(manual.status).toBe(0)

    const pullRequest = runTagScript('missing', {
      event: 'pull_request',
      sha: ''
    })
    expect(pullRequest.status).not.toBe(0)
    expect(pullRequest.stdout).toContain('did not include merge_commit_sha')
  })
})
