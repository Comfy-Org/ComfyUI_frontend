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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const workflowSchema = z.object({
  jobs: z.object({
    backport: z.object({
      steps: z.array(
        z.object({ id: z.string().optional(), run: z.string().optional() })
      )
    })
  })
})

const filterScript = () => {
  const workflow = workflowSchema.parse(
    parse(readFileSync('.github/workflows/pr-backport.yaml', 'utf8'))
  )
  const step = workflow.jobs.backport.steps.find(
    (step) => step.id === 'filter-targets'
  )
  if (!step?.run) throw new Error('Missing filter-targets script')
  return step.run
}

const GH_STUB = `#!/usr/bin/env bash
state="" head="" base=""
while [ $# -gt 0 ]; do
  case "$1" in
    --state) state="$2"; shift 2 ;;
    --head) head="$2"; shift 2 ;;
    --base) base="$2"; shift 2 ;;
    *) shift ;;
  esac
done
while IFS='|' read -r s h b n; do
  [ -z "$s" ] && continue
  if [ "$s" = "$state" ] && [ "$h" = "$head" ] && { [ -z "$base" ] || [ "$b" = "$base" ]; }; then
    echo "$n"
    exit 0
  fi
done <<< "$STUB_PRS"
echo ""
`

const GIT_STUB = `#!/usr/bin/env bash
for branch in $STUB_BRANCHES; do
  printf '0000000\\trefs/heads/%s\\n' "$branch"
done
`

interface StubPr {
  state: 'open' | 'merged'
  head: string
  base: string
  number: number
}

interface Scenario {
  targets: string[]
  prs?: StubPr[]
  branches?: string[]
  forceRerun?: boolean
}

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pr-backport-filter-'))
  for (const [name, body] of [
    ['gh', GH_STUB],
    ['git', GIT_STUB]
  ]) {
    writeFileSync(join(dir, name), body)
    chmodSync(join(dir, name), 0o755)
  }
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function runFilter({
  targets,
  prs = [],
  branches = [],
  forceRerun = false
}: Scenario) {
  const outputFile = join(dir, 'output')
  writeFileSync(outputFile, '')
  const result = spawnSync(
    'bash',
    ['--noprofile', '--norc', '-c', filterScript()],
    {
      env: {
        PATH: `${dir}:${process.env.PATH}`,
        GITHUB_OUTPUT: outputFile,
        EVENT_NAME: forceRerun ? 'workflow_dispatch' : 'pull_request_target',
        FORCE_RERUN_INPUT: String(forceRerun),
        PR_NUMBER: '21829',
        REQUESTED_TARGETS: targets.join(' '),
        STUB_PRS: prs
          .map((pr) => [pr.state, pr.head, pr.base, pr.number].join('|'))
          .join('\n'),
        STUB_BRANCHES: branches.join(' ')
      },
      encoding: 'utf8'
    }
  )
  if (result.status !== 0) throw new Error(result.stderr)
  return Object.fromEntries(
    readFileSync(outputFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf('=')
        return [line.slice(0, index), line.slice(index + 1)]
      })
  )
}

const mergedCore157: StubPr = {
  state: 'merged',
  head: 'backport-21829-to-core-1.57',
  base: 'core/1.57',
  number: 21880
}

describe('pr-backport filter-targets', () => {
  it('attempts only the new target when an old target was already merged', () => {
    expect(
      runFilter({ targets: ['core/1.57', 'cloud/1.58'], prs: [mergedCore157] })
    ).toMatchObject({
      skip: 'false',
      'pending-targets': 'cloud/1.58',
      'already-exists': 'core/1.57 (merged PR #21880)'
    })
  })

  it('skips the run when every target was already merged', () => {
    expect(
      runFilter({ targets: ['core/1.57'], prs: [mergedCore157] })
    ).toMatchObject({ skip: 'true', 'pending-targets': '' })
  })

  it('ignores a merged PR from the backport branch into a different base', () => {
    expect(
      runFilter({
        targets: ['core/1.57'],
        prs: [{ ...mergedCore157, base: 'main' }]
      })
    ).toMatchObject({ skip: 'false', 'pending-targets': 'core/1.57' })
  })

  it('retries a merged target when force_rerun is set', () => {
    expect(
      runFilter({
        targets: ['core/1.57'],
        prs: [mergedCore157],
        forceRerun: true
      })
    ).toMatchObject({ skip: 'false', 'pending-targets': 'core/1.57' })
  })

  it('still skips a target whose backport PR is open', () => {
    expect(
      runFilter({
        targets: ['core/1.57'],
        branches: ['backport-21829-to-core-1.57'],
        prs: [{ ...mergedCore157, state: 'open', number: 21881 }]
      })
    ).toMatchObject({
      skip: 'true',
      'already-exists': 'core/1.57 (PR #21881)'
    })
  })
})
